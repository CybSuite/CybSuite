from pathlib import Path

from cybsuite.cyberdb import BaseIngestor, Metadata


class ImpacketNtdsIngestor(BaseIngestor):
    name = "impacket_ntds"
    metadata = Metadata(
        description="Ingest NTDS dump from impacket. Feed password, hash, ad_user."
    )

    autodetect_is_file = True

    @classmethod
    def autodetect_from_path(cls, path: Path) -> bool:
        first_chars = cls.autodetect_get_first_500_chars(path)
        if (
            first_chars.startswith("Impacket v")
            and "[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)" in first_chars
        ):
            return True
        return False

    def do_run(self, filepath):
        for line in self.iter_lines_from_filepath(filepath):
            if line.startswith("Impacket ") or line.startswith("["):
                continue

            # TODO: handle DPAPI keys
            if line.startswith("dpapi_machinekey"):
                continue

            if line.startswith("dpapi_userkey"):
                continue

            if line.startswith("NL$KM"):
                continue

            if "   " in line:
                # Skip lines like 0000   37 E8 B2 2D F9 5A 74 18
                continue

            parts = line.split(":")

            # TODO: handle aes/des
            if len(parts) == 3 and parts[1] in [
                "aes128-cts-hmac-sha1-96",
                "des-cbc-md5",
                "aes256-cts-hmac-sha1-96",
            ]:
                continue

            if len(parts) >= 2 and parts[1] == "plain_password_hex":
                continue

            # Handle "CLEARTEXT" passwords
            if len(parts) == 3 and parts[1] == "CLEARTEXT":
                domain_name, user_name = self._get_domaine_name_and_user_name(parts[0])
                password = parts[2]
                self.feed(
                    "ad_user", name=user_name, domain=domain_name, password=password
                )
                continue

            if len(parts) == 7:
                user, rid, lm, ntlm, *_ = parts

                if len(ntlm) != 32:
                    raise ValueError(f"Expected NTLM to be of length 32 {line}")
                # TODO: handle machine accounts
                if user.endswith("$"):
                    continue

                if "\\" in user:
                    domain, user = self._get_domaine_name_and_user_name(user)
                    self.feed(
                        "ad_user", domain=domain, name=user, lm=lm, ntlm=ntlm, rid=rid
                    )
                else:
                    # TODO: handle local user, but we dont have machine/DC name!
                    pass
                continue

            if len(parts) == 6:
                # TODO: parse it
                # Same as 7 but RID not present
                continue

            # TODO: log unparsed line

    def _get_domaine_name_and_user_name(self, domain_name_user):
        domain_name, user_name = domain_name_user.split("\\")
        domain_name = domain_name.lower()
        user_name = user_name.lower()
        return domain_name, user_name
