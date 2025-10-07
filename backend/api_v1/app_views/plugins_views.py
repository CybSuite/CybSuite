import json
import os
import tempfile

from cybsuite.cyberdb import (
    CyberDB,
    pm_cyberdb_scanner,
    pm_formatters,
    pm_ingestors,
    pm_reporters,
)
from django.core.cache import cache
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from ..utils import (
    decompress_file,
    run_ingest_async,
    run_multiple_ingests_async,
    run_multiple_scans_async,
    run_scan_async,
)


# Ingest Operations Endpoints
@api_view(["GET"])
def list_ingestors(request):
    """Get a list of all available data ingestors"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    ingestors = [{"name": plugin.name} for plugin in pm_ingestors]
    return Response(ingestors)


@api_view(["POST"])
@parser_classes([MultiPartParser])
def ingest_data(request, ingestor_name):
    """Ingest data using the specified ingestor plugin"""
    db = CyberDB.from_default_config()
    if db is None or pm_ingestors is None:
        return Response(
            {"error": "Database or ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get uploaded file
        if "file" not in request.FILES:
            return Response(
                {"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES["file"]

        # Check if the uploaded item is a folder (folders typically have size 0 and no content)
        if file.size == 0 and (
            not hasattr(file, "content_type")
            or file.content_type == "application/octet-stream"
        ):
            return Response(
                {
                    "error": "Folder uploads are not supported. Please upload individual files only."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_content = file.read()

        # Decode bytes to text with UTF-8, fallback to latin-1
        try:
            if isinstance(file_content, bytes):
                try:
                    file_text = file_content.decode("utf-8")
                except UnicodeDecodeError:
                    file_text = file_content.decode("latin-1")
            else:
                file_text = file_content
        except Exception as decode_error:
            return Response(
                {"error": f"Failed to decode file content: {str(decode_error)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create temporary file for the ingestor
        import tempfile

        temp_file = tempfile.NamedTemporaryFile(
            mode="w", delete=False, suffix=f"_{file.name}"
        )
        try:
            temp_file.write(file_text)
            temp_file.flush()
            temp_file_path = temp_file.name
        finally:
            temp_file.close()

        # Validate ingestor exists
        available_ingestors = [plugin.name for plugin in pm_ingestors]
        if ingestor_name not in available_ingestors:
            # Clean up temp file
            import os

            try:
                os.unlink(temp_file_path)
            except:
                pass
            return Response(
                {"error": f"Ingestor '{ingestor_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Run the ingestor using CyberDB's ingest method
        try:
            db.ingest(ingestor_name, temp_file_path)
        finally:
            # Clean up temporary file
            import os

            try:
                os.unlink(temp_file_path)
            except:
                pass

        return Response(
            {
                "status": "success",
                "message": f"Data ingested successfully using {ingestor_name}",
                "details": None,
            }
        )

    except Exception as e:
        return Response(
            {"error": f"Error ingesting data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# New Ingest Operations Endpoints with async support and file upload
@api_view(["POST"])
@parser_classes([MultiPartParser])
def start_ingest(request):
    """Start a new ingest (single ingestor or multiple ingestors) with file upload support"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if an ingest is already running
        current_status = cache.get("current_ingest_status", {})
        if current_status.get("status") == "running":
            return Response(
                {
                    "error": "An ingest is already running",
                    "current_ingestor": current_status.get("ingestor_name"),
                    "start_time": current_status.get("start_time"),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Check if this is compressed file mode
        compressed_file_mode = request.data.get("compressed_file_mode") == "true"

        # Get uploaded files and save them to temporary files
        files = []
        has_compressed_files = False  # Track if we processed any compressed files
        for key in request.FILES:
            if key.startswith("files["):
                file_obj = request.FILES[key]

                # Check if the uploaded item is a folder
                if file_obj.size == 0 and (
                    not hasattr(file_obj, "content_type")
                    or file_obj.content_type == "application/octet-stream"
                ):
                    return Response(
                        {
                            "error": f"Folder uploads are not supported. '{file_obj.name}' appears to be a folder. Please upload individual files only."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if compressed_file_mode:
                    # Handle compressed files
                    compressed_extensions = [
                        ".zip",
                        ".tar",
                        ".tar.gz",
                        ".rar",
                        ".7z",
                        ".gz",
                        ".bz2",
                    ]
                    is_compressed = any(
                        file_obj.name.lower().endswith(ext)
                        for ext in compressed_extensions
                    )

                    if not is_compressed:
                        return Response(
                            {
                                "error": f"File '{file_obj.name}' is not a supported compressed file format. Supported formats: {', '.join(compressed_extensions)}"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    # Create a temporary file for the compressed file
                    temp_compressed_file = tempfile.NamedTemporaryFile(
                        delete=False, suffix=f"_compressed_{file_obj.name}"
                    )

                    # Write compressed file content (keep as binary)
                    file_content = file_obj.read()
                    temp_compressed_file.write(file_content)
                    temp_compressed_file.close()

                    # Decompress the file to a temporary directory
                    try:
                        decompressed_dir = decompress_file(
                            temp_compressed_file.name, file_obj.name
                        )
                        files.append(
                            decompressed_dir
                        )  # Store directory path instead of file path
                        has_compressed_files = (
                            True  # Mark that we processed compressed files
                        )
                    except Exception as e:
                        # Clean up the temporary compressed file
                        os.unlink(temp_compressed_file.name)
                        return Response(
                            {
                                "error": f"Failed to decompress '{file_obj.name}': {str(e)}"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    finally:
                        # Clean up the temporary compressed file
                        if os.path.exists(temp_compressed_file.name):
                            os.unlink(temp_compressed_file.name)
                else:
                    # Handle regular files (existing logic)
                    # Create a temporary file
                    temp_file = tempfile.NamedTemporaryFile(
                        mode="w+", delete=False, suffix=f"_{file_obj.name}"
                    )

                    # Read and decode the file content
                    file_content = file_obj.read()
                    try:
                        if isinstance(file_content, bytes):
                            file_content = file_content.decode("utf-8")
                    except UnicodeDecodeError:
                        # If UTF-8 decoding fails, try latin-1 as fallback
                        try:
                            file_content = file_content.decode("latin-1")
                        except UnicodeDecodeError:
                            # If all else fails, use error handling
                            file_content = file_content.decode(
                                "utf-8", errors="replace"
                            )

                    # Write content to temporary file
                    temp_file.write(file_content)
                    temp_file.close()

                    # Store the temporary file path
                    files.append(temp_file.name)

        if not files:
            return Response(
                {"error": "No files provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check for both single ingestor and multiple ingestors formats
        ingestor_name = request.data.get("ingestor_name")
        ingestor_names_str = request.data.get("ingestor_names")

        # Parse ingestor_names if it's a JSON string
        ingestor_names = None
        if ingestor_names_str:
            try:
                ingestor_names = (
                    json.loads(ingestor_names_str)
                    if isinstance(ingestor_names_str, str)
                    else ingestor_names_str
                )
            except json.JSONDecodeError:
                return Response(
                    {"error": "ingestor_names must be valid JSON"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Handle multiple ingestors
        if ingestor_names:
            if not isinstance(ingestor_names, list) or len(ingestor_names) == 0:
                return Response(
                    {"error": "ingestor_names must be a non-empty list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate all ingestor names exist
            available_ingestors = [plugin.name for plugin in pm_ingestors]
            invalid_ingestors = [
                name for name in ingestor_names if name not in available_ingestors
            ]

            if invalid_ingestors:
                return Response(
                    {"error": f"Ingestors not found: {', '.join(invalid_ingestors)}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Safety check: Replace file-only ingestors with "all" if we have compressed files
            if has_compressed_files:
                original_ingestors = ingestor_names.copy()
                modified_ingestors = []

                for ingestor_name in ingestor_names:
                    # Find the ingestor plugin
                    selected_plugin = None
                    for plugin in pm_ingestors:
                        if plugin.name == ingestor_name:
                            selected_plugin = plugin
                            break

                    # Check if it's file-only
                    if (
                        selected_plugin
                        and hasattr(selected_plugin, "autodetect_is_file")
                        and selected_plugin.autodetect_is_file
                        and not getattr(selected_plugin, "autodetect_is_dir", False)
                    ):

                        # Replace with "all" ingestor, but avoid duplicates
                        if "all" not in modified_ingestors:
                            modified_ingestors.append("all")
                    else:
                        # Keep the original ingestor
                        modified_ingestors.append(ingestor_name)

                # Update the ingestor list if changes were made
                if modified_ingestors != original_ingestors:
                    ingestor_names = modified_ingestors
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.info(
                        f"Multi-ingest: Replaced file-only ingestors with 'all' ingestor "
                        f"for compressed file handling. Original: {original_ingestors}, "
                        f"Modified: {ingestor_names}"
                    )

            # Get additional ingest parameters from request
            ingest_kwargs = request.data.get("ingest_kwargs", {})

            # Start multiple ingests
            db = CyberDB.from_default_config()
            run_multiple_ingests_async(
                db, pm_ingestors, ingestor_names, files, ingest_kwargs
            )

            return Response(
                {
                    "status": "Multi-ingest started",
                    "ingestor_names": ingestor_names,
                    "total_ingestors": len(ingestor_names),
                    "total_files": len(files),
                    "message": f"Multi-ingest with {len(ingestor_names)} ingestors and {len(files)} file(s) has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Handle single ingestor (backward compatibility)
        elif ingestor_name:
            # Handle auto-detection for compressed files
            if ingestor_name == "auto-detect" and compressed_file_mode:
                try:
                    # Auto-detect ingestors for decompressed contents
                    detected_ingestors = []

                    for file_path in files:
                        # files contains directory paths for compressed files
                        if os.path.isdir(file_path):
                            # Scan directory for files and auto-detect
                            import glob

                            dir_files = glob.glob(
                                os.path.join(file_path, "**", "*"), recursive=True
                            )
                            dir_files = [f for f in dir_files if os.path.isfile(f)]

                            for dir_file in dir_files:
                                for plugin in pm_ingestors:
                                    try:
                                        if plugin.autodetect_from_path(dir_file):
                                            if plugin.name not in detected_ingestors:
                                                detected_ingestors.append(plugin.name)
                                            break  # Use first matching ingestor for this file
                                    except Exception:
                                        continue

                    if not detected_ingestors:
                        # No specific ingestors detected, use "all" as fallback
                        ingestor_name = "all"
                    else:
                        # Check if the detected ingestor can handle directories
                        first_detected = detected_ingestors[0]
                        first_detected_plugin = None

                        # Find the plugin class for the first detected ingestor
                        for plugin in pm_ingestors:
                            if plugin.name == first_detected:
                                first_detected_plugin = plugin
                                break

                        # If the detected ingestor is file-only (can't handle directories),
                        # use "all" ingestor as fallback to properly handle the directory structure
                        if (
                            first_detected_plugin
                            and hasattr(first_detected_plugin, "autodetect_is_file")
                            and first_detected_plugin.autodetect_is_file
                            and not getattr(
                                first_detected_plugin, "autodetect_is_dir", False
                            )
                        ):

                            ingestor_name = "all"
                            import logging

                            logger = logging.getLogger(__name__)
                            logger.info(
                                f"Detected ingestor '{first_detected}' is file-only, using 'all' ingestor "
                                f"to handle compressed file directory structure"
                            )
                        else:
                            # Use the detected ingestor (it can handle directories or is not file-only)
                            ingestor_name = first_detected

                except Exception as e:
                    return Response(
                        {"error": f"Auto-detection failed: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

            # Check if the ingestor exists (skip for auto-detect since we just set it)
            if ingestor_name != "auto-detect" and ingestor_name not in [
                plugin.name for plugin in pm_ingestors
            ]:
                return Response(
                    {"error": f"Ingestor '{ingestor_name}' not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Safety check: If user manually selected a file-only ingestor but we have
            # compressed files that were decompressed to directories, use "all" ingestor
            if ingestor_name != "auto-detect" and has_compressed_files:
                # Get the selected ingestor plugin
                selected_plugin = None
                for plugin in pm_ingestors:
                    if plugin.name == ingestor_name:
                        selected_plugin = plugin
                        break

                # Check if the selected ingestor is file-only
                if (
                    selected_plugin
                    and hasattr(selected_plugin, "autodetect_is_file")
                    and selected_plugin.autodetect_is_file
                    and not getattr(selected_plugin, "autodetect_is_dir", False)
                ):

                    import logging

                    logger = logging.getLogger(__name__)
                    logger.info(
                        f"User selected file-only ingestor '{ingestor_name}' but compressed files "
                        f"require directory handling, using 'all' ingestor as fallback"
                    )
                    ingestor_name = "all"

            # Get additional ingest parameters from request
            ingest_kwargs = request.data.get("ingest_kwargs", {})

            # Start the real ingest
            db = CyberDB.from_default_config()
            run_ingest_async(db, pm_ingestors, ingestor_name, files, ingest_kwargs)

            return Response(
                {
                    "status": "Ingest started",
                    "ingestor_name": ingestor_name,
                    "total_files": len(files),
                    "message": f"Ingest with {len(files)} file(s) has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        else:
            return Response(
                {
                    "error": "Either ingestor_name (for single ingest) or ingestor_names (for multi-ingest) is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        return Response(
            {"error": f"Error starting ingest: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_ingest_status(request):
    """Get current ingest status"""
    current_status = cache.get(
        "current_ingest_status",
        {
            "status": "idle",
            "ingestor_name": None,
            "start_time": None,
            "end_time": None,
            "progress": 0,
            "progress_bar": 0,
            "progress_type": "indeterminate",
            "current_portion": 0,
            "total_portions": None,
            "current_step": 0,
            "total_steps": None,
            "message": "No ingest running",
            "results": None,
            "error": None,
        },
    )

    return Response(current_status)


@api_view(["POST"])
@parser_classes([MultiPartParser])
def auto_detect_ingestors(request):
    """Auto-detect suitable ingestors for uploaded files"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get uploaded files and create temporary files for autodetection
        temp_files = []
        files = {}
        for key in request.FILES:
            if key.startswith("files["):
                file_obj = request.FILES[key]

                # Check if the uploaded item is a folder
                if file_obj.size == 0 and (
                    not hasattr(file_obj, "content_type")
                    or file_obj.content_type == "application/octet-stream"
                ):
                    return Response(
                        {
                            "error": f"Folder uploads are not supported. '{file_obj.name}' appears to be a folder. Please upload individual files only."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                file_content = file_obj.read()

                # Decode bytes to text with proper encoding handling
                try:
                    if isinstance(file_content, bytes):
                        try:
                            file_text = file_content.decode("utf-8")
                        except UnicodeDecodeError:
                            file_text = file_content.decode("latin-1")
                    else:
                        file_text = file_content
                except Exception:
                    file_text = file_content.decode("utf-8", errors="replace")

                # Create temporary file for autodetection
                import tempfile
                from pathlib import Path

                temp_file = tempfile.NamedTemporaryFile(
                    mode="w", delete=False, suffix=f"_{file_obj.name}"
                )
                try:
                    temp_file.write(file_text)
                    temp_file.flush()
                    temp_file_path = Path(temp_file.name)
                finally:
                    temp_file.close()

                temp_files.append(temp_file_path)
                files[file_obj.name] = temp_file_path

        if not files:
            return Response(
                {"error": "No files provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            detections = {}

            # For each file, check which ingestors can handle it using autodetect_from_path
            for filename, file_path in files.items():
                suitable_ingestors = []

                for plugin in pm_ingestors:
                    try:
                        # Use the real autodetect_from_path method from BaseIngestor
                        if plugin.autodetect_from_path(file_path):
                            suitable_ingestors.append(plugin.name)
                    except Exception:
                        # Skip ingestors that fail autodetection
                        continue

                detections[filename] = suitable_ingestors

            return Response({"detections": detections})

        finally:
            # Clean up temporary files
            import os

            for temp_file_path in temp_files:
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass

    except Exception as e:
        return Response(
            {"error": f"Error during auto-detection: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Report Operations Endpoints
@api_view(["GET"])
def get_reporter_data(request, reporter_name):
    """Get report data as JSON from the specified reporter"""
    db = CyberDB.from_default_config()
    if db is None or pm_reporters is None:
        return Response(
            {"error": "Database or reporters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if reporter exists
        if reporter_name not in [plugin.name for plugin in pm_reporters]:
            return Response(
                {"error": f"Reporter '{reporter_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the reporter plugin
        reporter = pm_reporters[reporter_name](db)

        # Check if reporter supports JSON data extraction
        if not hasattr(reporter, "do_processing"):
            return Response(
                {
                    "error": f"Reporter '{reporter_name}' does not support data extraction"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get query parameters for filtering
        latest_run = request.GET.get("latest_run")
        if latest_run:
            try:
                latest_run = int(latest_run)
                reporter.configure(latest_run=latest_run)
            except ValueError:
                return Response(
                    {"error": "Invalid latest_run parameter - must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            reporter.configure()

        # Generate the report data
        report_data = reporter.do_processing()

        return Response(report_data)

    except Exception as e:
        return Response(
            {"error": f"Error generating report data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def generate_report(request, reporter_name):
    """Generate a report using the specified reporter and return it as a downloadable file"""
    db = CyberDB.from_default_config()
    if db is None or pm_reporters is None:
        return Response(
            {"error": "Database or reporters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if reporter exists
        if reporter_name not in [plugin.name for plugin in pm_reporters]:
            return Response(
                {"error": f"Reporter '{reporter_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create temporary file
        reporter = pm_reporters[reporter_name](db)
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=reporter.extension
        ) as tmp_file:
            temp_path = tmp_file.name

        # Configure the reporter if needed
        latest_run = request.GET.get("latest_run")
        if latest_run:
            try:
                latest_run = int(latest_run)
                reporter.configure(latest_run=latest_run)
            except ValueError:
                return Response(
                    {"error": "Invalid latest_run parameter - must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            reporter.configure()

        # Generate the report
        reporter.run(temp_path)

        # Determine content type based on file extension
        if reporter.extension == ".html":
            content_type = "text/html"
        elif reporter.extension == ".json":
            content_type = "application/json"
        elif reporter.extension == ".xlsx":
            content_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        elif reporter.extension == ".csv":
            content_type = "text/csv"
        else:
            content_type = "application/octet-stream"

        # Return the file as a downloadable response
        response = FileResponse(
            open(temp_path, "rb"),
            content_type=content_type,
            as_attachment=True,
            filename=f"report_{reporter_name}{reporter.extension}",
        )

        # Clean up temp file after response
        # Note: In production, you might want to use a background task for cleanup
        def cleanup():
            try:
                os.unlink(temp_path)
            except:
                pass

        # Store cleanup function for later use
        response.cleanup = cleanup

        return response

    except Exception as e:
        return Response(
            {"error": f"Error generating report: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Scan Operations Endpoints
@api_view(["POST"])
def start_scan(request):
    """Start a new scan (single scanner or multiple scanners)"""
    if pm_cyberdb_scanner is None:
        return Response(
            {"error": "Scanners not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if a scan is already running
        current_status = cache.get("current_scan_status", {})
        if current_status.get("status") == "running":
            return Response(
                {
                    "error": "A scan is already running",
                    "current_scanner": current_status.get("scanner_name"),
                    "start_time": current_status.get("start_time"),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Check for both single scanner and multiple scanners formats
        scanner_name = request.data.get("scanner_name")
        scanner_names = request.data.get("scanner_names")

        # Handle multiple scanners
        if scanner_names:
            if not isinstance(scanner_names, list) or len(scanner_names) == 0:
                return Response(
                    {"error": "scanner_names must be a non-empty list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate all scanner names exist
            available_scanners = [plugin.name for plugin in pm_cyberdb_scanner]
            invalid_scanners = [
                name for name in scanner_names if name not in available_scanners
            ]

            if invalid_scanners:
                return Response(
                    {"error": f"Scanners not found: {', '.join(invalid_scanners)}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get additional scan parameters from request
            scan_kwargs = request.data.get("scan_kwargs", {})

            # Start multiple scans
            db = CyberDB.from_default_config()
            run_multiple_scans_async(db, pm_cyberdb_scanner, scanner_names, scan_kwargs)

            return Response(
                {
                    "status": "Multi-scan started",
                    "scanner_names": scanner_names,
                    "total_scanners": len(scanner_names),
                    "message": f"Multi-scan with {len(scanner_names)} scanners has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Handle single scanner (backward compatibility)
        elif scanner_name:
            # Check if the scanner exists
            if scanner_name not in [plugin.name for plugin in pm_cyberdb_scanner]:
                return Response(
                    {"error": f"Scanner '{scanner_name}' not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get additional scan parameters from request
            scan_kwargs = request.data.get("scan_kwargs", {})

            # Start the real scan
            db = CyberDB.from_default_config()
            run_scan_async(db, pm_cyberdb_scanner, scanner_name, scan_kwargs)

            return Response(
                {
                    "status": "Scan started",
                    "scanner_name": scanner_name,
                    "message": "Scan has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        else:
            return Response(
                {
                    "error": "Either scanner_name (for single scan) or scanner_names (for multi-scan) is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        return Response(
            {"error": f"Error starting scan: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_scan_status(request):
    """Get current scan status"""
    current_status = cache.get(
        "current_scan_status",
        {
            "status": "idle",
            "scanner_name": None,
            "start_time": None,
            "end_time": None,
            "progress": 0,
            "progress_bar": 0,
            "progress_type": "indeterminate",
            "current_portion": 0,
            "total_portions": None,
            "current_step": 0,
            "total_steps": None,
            "message": "No scan running",
            "results": None,
            "error": None,
        },
    )

    return Response(current_status)


# Plugin Operations Endpoints
@api_view(["GET"])
def get_reporters(request):
    """Get a list of all available reporters"""
    if pm_reporters is None:
        return Response(
            {"error": "Reporters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    reporters = [{"name": plugin.name} for plugin in pm_reporters]
    return Response(reporters)


@api_view(["GET"])
def get_ingestors(request):
    """Get a list of all available ingestors with metadata"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    ingestors = []
    for ingestor in pm_ingestors:
        ingestor_info = {"name": ingestor.name}
        if ingestor.metadata:
            ingestor_info["description"] = (
                ingestor.metadata.description
                if ingestor.metadata.description is not None
                else None
            )
        else:
            ingestor_info["description"] = None

        # Add autodetect capabilities if available
        if hasattr(ingestor, "autodetect_is_file"):
            ingestor_info["autodetect_is_file"] = ingestor.autodetect_is_file
        if hasattr(ingestor, "autodetect_is_dir"):
            ingestor_info["autodetect_is_dir"] = ingestor.autodetect_is_dir

        ingestors.append(ingestor_info)

    return Response(ingestors)


@api_view(["GET"])
def get_scanners(request):
    """Get a list of all available database scanners"""
    if pm_cyberdb_scanner is None:
        return Response(
            {"error": "Database scanners not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    db_scanners = []
    for scanner in pm_cyberdb_scanner:
        scanner_info = {"name": scanner.name}
        if scanner.metadata:
            scanner_info["description"] = (
                scanner.metadata.description
                if scanner.metadata.description is not None
                else None
            )
            scanner_info["tags"] = (
                scanner.metadata.tags if scanner.metadata.tags is not None else []
            )
        else:
            scanner_info["description"] = None
            scanner_info["tags"] = []

        db_scanners.append(scanner_info)

    return Response(db_scanners)


@api_view(["GET"])
def get_formatters(request):
    """Get a list of all available data formatters"""
    if pm_formatters is None:
        return Response(
            {"error": "Formatters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    formatters = []
    for plugin in pm_formatters:
        formatter_info = {"name": plugin.name}
        if hasattr(plugin, "metadata") and plugin.metadata:
            formatter_info["description"] = (
                plugin.metadata.description
                if plugin.metadata.description is not None
                else None
            )
        else:
            formatter_info["description"] = None
        formatters.append(formatter_info)

    return Response(formatters)
