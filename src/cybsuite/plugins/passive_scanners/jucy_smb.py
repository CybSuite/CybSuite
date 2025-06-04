from cybsuite.cyberdb import BasePassiveScanner, Metadata
from pathlib import Path

JUCY_EXTENSIONS = [
    ".kdb",
    ".kdbx",
    ".key",
    ".pfx",
    ".p12",
    ".ovpn",
    ".sqlite",
    ".sqlite3",
    ".one",
]

SKIP_EXTENSIONS = {
        ".adml",
        ".admx",
        ".md5",
        ".sha1",
        ".sha512",
        ".dsx",  # image
        ".dll",
        ".jpg",
        ".png",
        ".gif",
        ".bmp",
        ".tiff",
        ".ico",
        ".webp",
}

NAMES = {
        "empty.txt",
        "password.txt",
        "conf.php",
        "backupcodes.txt",
        "evil_dll.dll",
        "credential.xml",
        "mot_de_passe.txt",
        "mdp.txt",
        "mdp_administrator.txt",  # FIXME: for later
        "mdp_admin.txt",
        "mot_de_passe_admin.txt",
        "mots_de_passe_chrome.csv",
        "nouveau_document_texte.txt",
        "dump.sql",
        "db.sql",
        "backup.sql",
    }


IN_NAME_LOWER = {
    "password",
    "creds",
    "backup",
    "veeam",
    "secret",
    "mot_de_pass",
    "mots_de_pass",
    "mdp",
}

LIMIT_FILES = 10000000


class JucySmbScanner(BasePassiveScanner):
    name = "jucy_smb"
    metadata = Metadata(
        description="Scan SMB files for interesting extensions that might contain credentials or sensitive data"
    )

    def do_run(self):
        processed_files = 0
        nb_files_jucy = 0

        for smb_file in self.cyberdb.request("smb_file"):
            # Stop after LIMIT_FILES files
            if processed_files >= LIMIT_FILES:
                return

            normalized_filename = Path(smb_file.file.lower().replace(" ", "_"))
            # First skip useless extensions
            if normalized_filename.suffix in SKIP_EXTENSIONS:
                continue

            file_is_jucy = False
            if normalized_filename.suffix in JUCY_EXTENSIONS:
                file_is_jucy = True
                rule_name = "SUFFIX"
                rule_value = normalized_filename.suffix
            elif normalized_filename.name in NAMES:
                file_is_jucy = True
                rule_name = "NAME"
                rule_value = normalized_filename.name
            elif any(name in normalized_filename.name for name in NAMES):
                file_is_jucy = True
                rule_name = "NAME-IN"
                rule_value = next(name for name in NAMES if name in normalized_filename.name)
            elif any(name in normalized_filename.name for name in IN_NAME_LOWER):
                file_is_jucy = True
                rule_name = "NAME-IN-LOWER"
                rule_value = next(name for name in IN_NAME_LOWER if name in normalized_filename.name)

            if file_is_jucy:
                nb_files_jucy += 1
                # Log to console
                self.logger.info(f"{rule_name:20} {smb_file.host} {smb_file.share} {smb_file.directory} {smb_file.file}")

                # Feed to jucy_search table
                self.cyberdb.feed("jucy_search",
                    rule_name=rule_name,
                    rule_value=rule_value,
                    value=f"{smb_file.host} {smb_file.share} {smb_file.directory}/{smb_file.file}",
                    category="smb_file"
                )

            processed_files += 1
        self.logger.info(f"Found {nb_files_jucy} jucy files out of {processed_files} files")



