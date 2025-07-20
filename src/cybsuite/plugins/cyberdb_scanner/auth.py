from cybsuite.cyberdb import BaseCyberDBScanner, Metadata
from django.db.models import Count


class ServicesVersionScanner(BaseCyberDBScanner):
    name = "auth"
    metadata = Metadata(
        description="Scan passwords and hashes, weak password, reuse, etc.",
        tags=["default"],
    )

    controls = [
        "password.reuse",
        "hash.reuse",
        "windows.lm_hash_used.ad_user",
        "windows.lm_hash_used.windows_user",
        "auth.reuse.duplicate",  # reuse password without same user
        "auth.reuse.cross.ad",
        "auth.reuse.cross.windows",
    ]

    LM_BLANK_HASH = "aad3b435b51404eeaad3b435b51404ee"
    NTLM_BLANK_HASH = "31d6cfe0d16ae931b73c59d7e0c089c0"
    # TODO: rethink this module! we should check mainly ad_user and windows_user, we dont care if it's password or hash (lm/ntlm) !
    # we are searching for users using same password in different apps/domain/hosts, and also reuse of password even if it's not the same user!
    # TODO: search for password reuse also between different things, example, user AD with user Windows!
    # TODO: must check
    #  Reuse for :
    #   Reuse for Windows users (lm, ntlm, password, in same computer and different computers)
    #   reuse user inter domain !
    #   reuse on linux hosts?
    #   reuse on windows hosts?
    #   password reuse all way? (every single password?)
    #   later check for other hashes? ()

    def do_run(self):
        # Checks done
        # - LM hash not used (for AD and Windows users)
        # - Password reuse (for AD users)
        # - Hash reuse for NTLM and LM (for AD users)

        self._scan_lm_hash_used()
        self._scan_auth_reuse_cross_ad()
        self._scan_auth_reuse_cross_windows()

        passwords = self._check_reuse(
            self.cyberdb.request("ad_user", password__isnull=False).exclude(
                password=""
            ),
            key="password",
        )
        for password, users in passwords.items():
            self.alert(
                "password.reuse",
                confidence="certain",
                details={
                    "password": password,
                    "users": [f"{user.domain.name}\\{user.name}" for user in users],
                    "count": len(users),
                },
            )

        ntlm_hashes = self._check_reuse(
            self.cyberdb.request("ad_user", ntlm__isnull=False).exclude(
                ntlm__in=[self.NTLM_BLANK_HASH, ""]
            ),
            key="ntlm",
        )
        for ntlm_hash, users in ntlm_hashes.items():
            self.alert(
                "hash.reuse",
                confidence="certain",
                details={
                    "hash_type": "ntlm",
                    "hash": ntlm_hash,
                    "users": [f"{user.domain.name}\\{user.name}" for user in users],
                    "count": len(users),
                },
            )

        lm_hashes = self._check_reuse(
            self.cyberdb.request("ad_user", lm__isnull=False).exclude(
                lm__in=[self.LM_BLANK_HASH, ""]
            ),
            key="lm",
        )
        for lm_hash, users in lm_hashes.items():
            self.alert(
                "hash.reuse",
                confidence="certain",
                details={
                    "hash_type": "lm",
                    "hash": lm_hash,
                    "users": [f"{user.domain.name}\\{user.name}" for user in users],
                    "count": len(users),
                },
            )

        return

        # TODO: check later that LM / NTLM / PASSWORD match or compute it

    def _scan_lm_hash_used(self):
        # Check for LM hash usage in both AD users and Windows users
        for user_type in ["ad_user", "windows_user"]:
            if not self.are_controls_enabled(f"windows.lm_hash_used.{user_type}"):
                continue

            for user in self.cyberdb.request(user_type, lm__isnull=False).exclude(
                lm__in=[self.LM_BLANK_HASH, ""]
            ):
                # TODO: normalize user/name in DB not normal that one is name other is user
                details = {
                    "lm": user.lm,
                }
                if user_type == "ad_user":
                    details["domain"] = str(user.domain)
                    details["username"] = user.name
                else:
                    details["host"] = str(user.host)
                    details["username"] = user.user

                self.alert(
                    f"windows.lm_hash_used.{user_type}",
                    details=details,
                    confidence="certain",
                )

    def _scan_auth_reuse_cross_ad(self):
        if not self.are_controls_enabled("auth.reuse.cross.ad"):
            return

        # Check for different credential types
        for cred_type in ["password", "ntlm", "lm"]:
            # Step 1: get reused credentials
            reused_creds = (
                self.cyberdb.request("ad_user")
                .values("name", cred_type)
                .filter(**{f"{cred_type}__isnull": False})
                .exclude(**{cred_type: ""})
                .annotate(domain_count=Count("domain", distinct=True))
                .filter(domain_count__gt=1)
            )

            # Step 2: get domains and alert
            for entry in reused_creds:
                # Skip blank/empty values for hashes
                if cred_type in ["ntlm", "lm"]:
                    blank_hash = (
                        self.NTLM_BLANK_HASH
                        if cred_type == "ntlm"
                        else self.LM_BLANK_HASH
                    )
                    if entry[cred_type] in [blank_hash, "", None]:
                        continue

                users = self.cyberdb.request("ad_user").filter(
                    name=entry["name"], **{cred_type: entry[cred_type]}
                )

                self.alert(
                    "auth.reuse.cross.ad",
                    confidence="certain",
                    details={
                        "username": entry["name"],
                        "credential_type": cred_type,
                        "credential_value": entry[cred_type],
                        "domains": sorted([user.domain.name for user in users]),
                    },
                )

    def _scan_auth_reuse_cross_windows(self):
        if not self.are_controls_enabled("auth.reuse.cross.windows"):
            return

        # Check for different credential types
        for cred_type in ["password", "ntlm", "lm"]:
            # Step 1: get reused credentials
            reused_creds = (
                self.cyberdb.request("windows_user")
                .values("user", cred_type)
                .filter(**{f"{cred_type}__isnull": False})
                .exclude(**{cred_type: ""})
                .annotate(host_count=Count("host", distinct=True))
                .filter(host_count__gt=1)
            )

            # Step 2: get hosts and alert
            for entry in reused_creds:
                # Skip blank/empty values for hashes
                if cred_type in ["ntlm", "lm"]:
                    blank_hash = (
                        self.NTLM_BLANK_HASH
                        if cred_type == "ntlm"
                        else self.LM_BLANK_HASH
                    )
                    if entry[cred_type] in [blank_hash, "", None]:
                        continue

                users = self.cyberdb.request("windows_user").filter(
                    user=entry["user"], **{cred_type: entry[cred_type]}
                )

                self.alert(
                    "auth.reuse.cross.windows",
                    confidence="certain",
                    details={
                        "username": entry["user"],
                        "credential_type": cred_type,
                        "credential_value": entry[cred_type],
                        "hosts": sorted([user.host.ip for user in users]),
                    },
                )

    @staticmethod
    def _check_reuse(iterable, key, blank_values=None):
        """
        Groups objects by the value of a given key, ignoring blank/ignored values.
        Returns a dict: {value: [objects...]} for values that appear more than once.
        key: function or string (attribute name)
        blank_values: set/list of values to ignore (default: [None, ""])
        """
        from collections import defaultdict

        if blank_values is None:
            blank_values = {None, ""}
        else:
            blank_values = set(blank_values)

        groups = defaultdict(list)
        for obj in iterable:
            if callable(key):
                value = key(obj)
            else:
                value = getattr(obj, key)
            if value in blank_values:
                continue
            groups[value].append(obj)
        # Only return groups with more than one object (i.e., reused)
        return {v: objs for v, objs in groups.items() if len(objs) > 1}
