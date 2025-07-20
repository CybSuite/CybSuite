import os
from functools import cache
from pathlib import Path

from cybsuite.cyberdb import BaseIngestor, Metadata, pm_ingestors


class MasscanIngestor(BaseIngestor):
    name = "all"
    metadata = Metadata(description="Ingest all output file")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @cache
    def _get_plugin_instance(self, plugin_name: str):
        plugin_cls = pm_ingestors[plugin_name]
        return plugin_cls(self.cyberdb)

    def do_run(self, filepath, allow_multiple_ingestion: bool = None):
        if allow_multiple_ingestion is None:
            allow_multiple_ingestion = False

        path = os.path.abspath(filepath)
        # If Ingestor didnt define autodetect dont test it
        cls_ingestors = [
            cls_ingestor
            for cls_ingestor in pm_ingestors
            if cls_ingestor.autodetect_from_path
            is not BaseIngestor.autodetect_from_path
        ]

        # Get ingestor that can handle dir or file (but not file only), to filter when iterating dirs, and optimize
        cls_ingestors_not_file_only = [
            cls_ingestor
            for cls_ingestor in cls_ingestors
            if not cls_ingestor.autodetect_is_file
        ]
        cls_ingestors_not_dir_only = [
            cls_ingestor
            for cls_ingestor in cls_ingestors
            if not cls_ingestor.autodetect_is_dir
        ]

        for root, dirs, files in os.walk(path):
            root_as_path = Path(root)
            matched = False
            for ingestor_cls in cls_ingestors_not_file_only:
                if ingestor_cls.autodetect_from_path(root_as_path):
                    self.logger.info(f"[MATCH DIR] {root} -> {ingestor_cls.name}")
                    ingestor_instance = self._get_plugin_instance(ingestor_cls.name)
                    try:
                        ingestor_instance.run(root)
                    except Exception as e:
                        self.logger.error(
                            f"Error ingesting {root} with {cls_ingestors.name} ingestor: {type(e).__name__} - {str(e)}"
                        )

                    matched = True
                    break

            if matched and not allow_multiple_ingestion:
                # On vide dirs → empêche os.walk de descendre plus loin
                dirs[:] = []
                continue

            # Sinon on teste les fichiers
            for file in files:
                file_as_path = Path(os.path.join(root, file))
                for ingestor_cls in cls_ingestors_not_dir_only:
                    if ingestor_cls.autodetect_from_path(file_as_path):
                        self.logger.info(
                            f"[MATCH FILE] {file_as_path} -> {ingestor_cls.name}"
                        )
                        ingestor_instance = self._get_plugin_instance(ingestor_cls.name)
                        try:
                            ingestor_instance.run(file_as_path)
                        except Exception as e:
                            self.logger.error(
                                f"Error ingesting {file_as_path} with {ingestor_cls.name} ingestor: {type(e).__name__} - {str(e)}"
                            )
                        if not allow_multiple_ingestion:
                            break
