import ipaddress
import os
from io import StringIO
from pathlib import Path
from typing import Iterable, List, Union

import yaml
from cybsuite.core.logger import get_logger
from cybsuite.cyberdb.db_schema import cyberdb_schema

from ..bases.base_cyberdb_scanner import pm_cyberdb_scanner
from ..bases.base_formatter import pm_formatters
from ..bases.base_ingestor import pm_ingestors
from ..consts import KNOWLEDGEBASE_NAME, PATH_KNOWLEDGEBASE
from .models import BaseCyberDB

logger = get_logger()


class CyberDB(BaseCyberDB):
    _cyberdb = None

    def __init__(self, *args, mission=None, **kwarg):
        super().__init__(*args, **kwarg)
        self.mission = mission

    def clear_knowledgebase(self):
        for entity in cyberdb_schema.filter(tags="knowledgebase"):
            self.clear_one_model(entity.name)

    def clear_no_knowledgebase(self):
        for entity in cyberdb_schema:
            if "knowledgebase" not in entity.tags:
                self.clear_one_model(entity.name)

    @classmethod
    def from_default_config(cls) -> "CyberDB":
        from cybsuite.cyberdb.config import cyberdb_config

        if cls._cyberdb is None:
            # Prioritize environment variables over default config
            cls._cyberdb = CyberDB(
                os.environ.get("CYBSUITE_DB_NAME", cyberdb_config["name"]),
                user=os.environ.get("CYBSUITE_DB_USER", cyberdb_config["user"]),
                password=os.environ.get(
                    "CYBSUITE_DB_PASSWORD", cyberdb_config["password"]
                ),
                port=int(os.environ.get("CYBSUITE_DB_PORT", cyberdb_config["port"])),
                host=os.environ.get("CYBSUITE_DB_HOST", cyberdb_config["host"]),
            )

        return cls._cyberdb

    # CONVINIENCE METHODS #
    # =================== #

    def resolve_ip(self, ip: str) -> List[str]:
        """Return all domain names that resolve to the given IP"""
        return [e.domain_name for e in self.request("dns", ip=ip)]

    def resolve_domain_name(self, domain_name: str) -> List[str]:
        """Return all IPs that the given domain name resolves to"""
        return [e.ip for e in self.request("dns", domain_name=domain_name)]

    def resolve(self, value: str) -> List[str]:
        """Return all domain names or IPs associated with the given value"""
        try:
            # Try to parse as IP address
            ipaddress.ip_address(value)
            return self.resolve_ip(value)
        except ValueError:
            # If not valid IP, treat as domain name
            return self.resolve_domain_name(value)

    # PLUGINS RELATED METHODS #
    # ======================= #
    # TODO: not finished
    def request(
        self,
        _model_name,
        format: str = None,
        skip: int = None,
        limit: int = None,
        filters: dict = None,
        fields: list = None,
        no_fields: list = None,
        output: str = None,
        remove_empty_fields: bool = None,
        order_by=None,
        as_dict: bool = None,
        **_filters,
    ) -> Iterable[dict]:
        # TODO: type annotation of return is wrong, if format is None, we return instances not dicts
        # Ensure no overlapping keys between filters and _filters
        if filters is not None:
            common_keys = set(filters.keys()) & set(_filters.keys())
            if common_keys:
                raise ValueError(f"Duplicate filter keys found: {common_keys}")
            _filters.update(filters)

        data = super().request(_model_name, **_filters)
        if order_by is not None:
            data = data.order_by(order_by)
        if skip is not None:
            data = data[skip:]
        if limit is not None:
            data = data[:limit]

        if format is None and not as_dict:
            return data

        # Get entity schema to determine fields
        entity = self.schema[_model_name]
        fields_objects = [f for f in entity if not f.is_linked_by_related_name]
        fields_names = [f.name for f in fields_objects]
        # Include or exclude fields
        if fields is not None:
            fields_names = [f for f in fields_names if f in fields]
        if no_fields is not None:
            fields_names = [f for f in fields_names if f not in no_fields]

        # Convert to dict
        data = (
            self.model_to_dict_with_str_fk(row, fields=fields_names) for row in data
        )
        if remove_empty_fields:
            nullabled_fields = [f.name for f in entity if f.nullable and not f.required]
            many_to_many_fields = [f.name for f in entity if f.is_many_to_many_field()]
            data = (
                {
                    k: v
                    for k, v in row.items()
                    if not (k in nullabled_fields and v is None)
                    and not (k in many_to_many_fields and v == [])
                }
                for row in data
            )

        if as_dict:
            # TODO: test as dict with none and ...
            return data

        # Get field names based on formatter settings
        formatter = pm_formatters[format]()
        if not formatter.include_hidden_fields:
            fields_names = [
                f.name
                for f in fields_objects
                if not f.hidden_in_list and f.name in fields_names
            ]
        # Format the data using the specified formatter
        if output is None:
            output = StringIO()
        elif isinstance(output, str):
            # TODO: close file?
            output = open(output, "w")
        formatter.format(data, output, fields_names)

        if isinstance(output, StringIO):
            return output.getvalue()
        else:
            return output

    def get_controls(self, control_name: str, **filters):
        return self.request("control", control_definition__name=control_name, **filters)

    def get_observations(self, control_name: str, **filters):
        return self.request(
            "control", control_definition__name=control_name, status="ko", **filters
        )

    def scan(self, scanner_name):
        scanner_cls = pm_cyberdb_scanner[scanner_name]
        scanner_instance = scanner_cls(self)
        scanner_instance.run()

    def scan_for_controls(self, controls_to_check: List[str] | str):
        # Normalize input
        if isinstance(controls_to_check, str):
            controls_to_check = [controls_to_check]
        controls_to_check = set(controls_to_check)

        # Get scanners that match the requested controls
        matching_scanners_names = set()
        covered_controls = set()

        for scanner_cls in pm_cyberdb_scanner:
            matching_controls = [
                control_to_check
                for control_to_check in controls_to_check
                if control_to_check in scanner_cls.controls
            ]
            if matching_controls:
                matching_scanners_names.add(scanner_cls.name)
                covered_controls.update(matching_controls)

        # Check for controls without scanners
        uncovered_controls = set(controls_to_check) - covered_controls
        if uncovered_controls:
            raise ValueError(
                f"No scanners found for controls: {list(uncovered_controls)}"
            )

        # Run all matching scanners
        for scanner_cls_name in matching_scanners_names:
            matching_controls = [
                control
                for control in controls_to_check
                if control in pm_cyberdb_scanner[scanner_cls_name].controls
            ]
            logger.info(
                f"Running scanner '{scanner_cls_name}' for controls: {matching_controls}"
            )
            scanner_cls = pm_cyberdb_scanner[scanner_cls_name]
            scanner_instance = scanner_cls(self)
            scanner_instance.run()

    def ingest(
        self,
        toolname: str,
        filepaths: Union[str, Path, List[Union[str, Path]]],
        source_network=None,
    ):
        if isinstance(filepaths, (str, Path)):
            filepaths = [filepaths]

        ingestor_cls = pm_ingestors[toolname]
        ingestor_instance = ingestor_cls(self)
        ingestor_instance.source_network = source_network
        for filepath in filepaths:
            logger.info(f"Ingesting {filepath}")
            try:
                ingestor_instance.run(filepath)
            except Exception as e:
                logger.error(
                    f"Error ingesting file {filepath} with {toolname} ingestor: {type(e).__name__} - {str(e)}"
                )
                raise e

    def export_all_tables(self, output_dir: Union[str, Path], force: bool = False):
        """Export all tables data to JSONL files in the specified directory"""
        # TODO: debug it!
        # TODO: add option to sort? so that in git diff we dont have this
        output_dir = Path(output_dir)

        # Check if output directory already exists
        if output_dir.exists():
            if force:
                import shutil

                shutil.rmtree(output_dir)
                logger.info(f"Removed existing directory: {output_dir}")
            else:
                raise FileExistsError(
                    f"Output directory '{output_dir}' already exists. Please choose a different directory to avoid overwriting existing data or use --force to remove it."
                )

        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=False)

        exported_count = 0
        empty_count = 0

        for entity in cyberdb_schema:
            table_name = entity.name
            output_file = output_dir / f"{table_name}.jsonl"

            if self.is_empty(table_name):
                empty_count += 1
                continue

            try:
                # Write data to file using output parameter
                self.request(
                    table_name,
                    format="jsonl",
                    output=str(output_file),
                    remove_empty_fields=True,
                )
                logger.info(f"Exported {table_name} to {output_file}")
                exported_count += 1
            except Exception as e:
                logger.error(
                    f"Error exporting table {table_name}: {type(e).__name__} - {str(e)}"
                )
                continue

        logger.info(
            f"Export completed: {exported_count} tables exported, {empty_count} empty tables skipped"
        )

    def export_knowledgebase(
        self, kb_name: str, export_path: Union[str, Path], *, force: bool = False
    ):
        """Export a specific knowledge base to a directory structure"""
        export_path = Path(export_path)

        # TODO: Replace with actual knowledge base list
        valid_kbs = [KNOWLEDGEBASE_NAME]
        if kb_name not in valid_kbs:
            raise ValueError(
                f"Knowledge base '{kb_name}' not found. Valid knowledge bases: {valid_kbs}"
            )

        # Check if export directory already exists
        if export_path.exists():
            if force:
                import shutil

                shutil.rmtree(export_path)
                logger.info(f"Removed existing directory: {export_path}")
            else:
                raise FileExistsError(
                    f"Export directory '{export_path}' already exists. Use --force to remove it."
                )

        # Create export directory
        export_path.mkdir(parents=True, exist_ok=True)

        # Iterate through schema tables with knowledgebase tag
        for entity in cyberdb_schema.filter(tags="knowledgebase"):
            table_name = entity.name

            # Skip the knowledgebase table itself
            if table_name == "knowledgebase":
                continue

            # Pass the export path and table name to the export function
            try:
                self._export_kb_one_table(table_name, kb_name, export_path)
            except Exception as e:
                logger.error(
                    f"Error exporting table '{table_name}': {type(e).__name__} - {str(e)}"
                )
                raise e
                continue

        logger.info(f"Knowledge base '{kb_name}' export completed to: {export_path}")

    def _export_kb_one_table(self, table_name: str, kb_name: str, export_path: Path):
        """Export a single table for a knowledge base"""
        from itertools import groupby

        # Check if there are any entries to export
        if self.is_empty(table_name):
            logger.info(f"Skipping table '{table_name}' - no data found")
            return

        # Create table directory only if we have data to export
        table_dir = export_path / table_name
        table_dir.mkdir(parents=True, exist_ok=True)

        # Get all entries for this table with the specific knowledge base
        entries = self.request(
            table_name,
            knowledgebase__name=kb_name,
            order_by="knowledgebase_path",
            remove_empty_fields=True,
            as_dict=True,
        )

        # TODO: what if we have None what file we do put? we will have collision?

        # Sort by path for groupby to work properly
        grouped_entries = groupby(entries, key=lambda x: x["knowledgebase_path"])

        exported_count = 0

        entity_description = cyberdb_schema[table_name]

        # Get fields with in_filter_query for sorting
        filter_query_fields = [
            field.name for field in entity_description.get_in_filter_query_attributes()
        ]

        def sort_key(e):
            out = []
            for k in filter_query_fields:
                v = e.get(k)
                out.append((0, v) if v is not None else (1,))
            return tuple(out)

        for path, group_entries in grouped_entries:
            # TODO: better handling of unsafe paths
            if ".." in path:
                logger.warning(f"Skipping entry with unsafe path: {path}")
                continue

            path = table_dir / f"{path}.yaml"
            path.parent.mkdir(parents=True, exist_ok=True)

            # Sort the group entries by in_filter_query fields
            group_entries = list(group_entries)

            group_entries.sort(key=sort_key)

            # Sort each entry's fields by entity field order
            for entry in group_entries:
                entry.pop("knowledgebase_path")
                entry.pop("knowledgebase")

                # Keys are already ordred, since we take by default the order of the schema when converting to dict

            exported_count += len(group_entries)

            with open(path, "w") as f:
                yaml.safe_dump(group_entries, f, allow_unicode=True, sort_keys=False)

        logger.info(
            f"Exported {exported_count} entries from table '{table_name}' to {table_dir}"
        )

    def import_knowledgebase(self, path: Union[str, Path], *, name: str = None):
        """Import a knowledge base from a directory structure"""
        # TODO: generated with IA, not seen yet
        kb_name = name
        del name
        import_path = Path(path)
        if not import_path.is_dir():
            raise ValueError(
                f"Import path '{import_path}' is not a directory or does not exist"
            )

        # Get all subdirectories (each represents a table)
        table_dirs = [d for d in import_path.iterdir() if d.is_dir()]
        imported_count = 0
        skipped_count = 0

        # Iterate through each table directory
        for table_dir in table_dirs:
            table_name = table_dir.name

            # Check if the table has the knowledgebase tag
            if table_name not in cyberdb_schema:
                logger.warning(f"Table '{table_name}' not found in schema, skipping")
                skipped_count += 1
                continue

            entity = cyberdb_schema[table_name]
            if "knowledgebase" not in entity.tags:
                logger.warning(
                    f"Table '{table_name}' does not have 'knowledgebase' tag, skipping"
                )
                skipped_count += 1
                continue

            # Skip the knowledgebase table itself
            if table_name == "knowledgebase":
                logger.info(
                    f"Skipping table '{table_name}' - cannot import knowledgebase table itself"
                )
                skipped_count += 1
                continue

            try:
                self._import_kb_one_table(table_name, table_dir, kb_name)
                imported_count += 1
            except Exception as e:
                logger.error(
                    f"Error importing table '{table_name}': {type(e).__name__} - {str(e)}"
                )
                skipped_count += 1
                continue

        logger.info(
            f"Knowledge base import completed: {imported_count} tables imported, {skipped_count} tables skipped"
        )

    def _import_kb_one_table(self, table_name: str, table_dir: Path, kb_name: str):
        # TODO: remove old KB methods
        """Import a single table for a knowledge base from YAML files"""
        imported_count = 0

        # Iterate recursively through all YAML files
        for yaml_file in table_dir.rglob("*.yaml"):
            try:
                # Read YAML file
                with open(yaml_file, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)

                # Handle both single entries and lists of entries
                if not isinstance(data, list):
                    data = [data]

                # Process each entry
                for entry in data:
                    if not isinstance(entry, dict):
                        logger.warning(f"Skipping non-dict entry in {yaml_file}")
                        continue

                    # Add knowledgebase reference
                    entry["knowledgebase"] = kb_name

                    # Calculate knowledgebase_path from file path
                    # Remove table_dir prefix and .yaml extension
                    relative_path = yaml_file.relative_to(table_dir)
                    knowledgebase_path = str(relative_path.with_suffix(""))

                    # Add knowledgebase_path
                    entry["knowledgebase_path"] = knowledgebase_path
                    # Feed the entry to the database
                    self.feed(table_name, **entry)
                    imported_count += 1

            except Exception as e:
                logger.error(
                    f"Error importing from {yaml_file}: {type(e).__name__} - {str(e)}"
                )
                continue

        if imported_count > 0:
            logger.info(f"Imported {imported_count} entries from table '{table_name}'")
        else:
            logger.warning(f"No entries imported from table '{table_name}'")

    def load_knowledgebase(self):
        self.import_knowledgebase(PATH_KNOWLEDGEBASE, name=KNOWLEDGEBASE_NAME)
