import math
import re
import string

from cybsuite.cyberdb import BaseCyberDBScanner, Metadata


class WeakPasswordScanner(BaseCyberDBScanner):
    name = "weakpassword"
    metadata = Metadata(
        description="Detect weak passwords in 'password', 'ad_user', and 'windows_user' tables",
        tags=["default"],
    )

    controls = [
        "auth.password.weak",
    ]
    REASON_SHORT = "short"
    REASON_LOW_ENTROPY = "low_entropy"
    REASON_NO_UPPER = "no_upper"
    REASON_NO_LOWER = "no_lower"
    REASON_NO_DIGIT = "no_digit"
    REASON_NO_SPECIAL = "no_special"
    REASON_KNOWN_WORD = "known_word"

    # Configuration variables
    SHORT_PASSWORD_LENGTH = 12
    SEVERITY_HIGH_ENTROPY = 40
    SEVERITY_MEDIUM_ENTROPY = 60
    SEVERITY_LOW_ENTROPY = 80

    # TODO: Check if user is admin, be more severe
    def do_run(self):
        if self.are_controls_enabled("auth.password.weak"):
            self._analyser_passwords()

    def _compute_entropy(self, password):
        pool_size = 0
        if any(c.islower() for c in password):
            pool_size += 26
        if any(c.isupper() for c in password):
            pool_size += 26
        if any(c.isdigit() for c in password):
            pool_size += 10
        if any(c in string.punctuation for c in password):
            pool_size += len(string.punctuation)
        if pool_size == 0:
            return 0
        return math.log2(pool_size) * len(password)

    def _analyse_password(self, password, entry, fields):
        entropy = self._compute_entropy(password)
        reasons = []
        severity = None

        if len(password) < self.SHORT_PASSWORD_LENGTH:
            reasons.append(self.REASON_SHORT)

        # Check for missing character types
        if not any(c.islower() for c in password):
            reasons.append(self.REASON_NO_LOWER)
        if not any(c.isupper() for c in password):
            reasons.append(self.REASON_NO_UPPER)
        if not any(c.isdigit() for c in password):
            reasons.append(self.REASON_NO_DIGIT)
        if not any(c in string.punctuation for c in password):
            reasons.append(self.REASON_NO_SPECIAL)

        # Determine severity based on entropy
        if entropy < self.SEVERITY_HIGH_ENTROPY:
            severity = "high"
            reasons.append(self.REASON_LOW_ENTROPY)
        elif entropy < self.SEVERITY_MEDIUM_ENTROPY:
            severity = "medium"
            reasons.append(self.REASON_LOW_ENTROPY)
        elif entropy < self.SEVERITY_LOW_ENTROPY:
            severity = "low"
            reasons.append(self.REASON_LOW_ENTROPY)

        # TODO: compute entropy after removing known words
        password_lower = password.lower()
        for field in fields:
            field_str = str(getattr(entry, field)).lower()
            for part in self._generic_split(field_str):
                if part in password_lower:
                    reasons.append(self.REASON_KNOWN_WORD)
                    break

        return entropy, reasons, severity

    def _generic_split(self, s):
        return re.findall(r"\w+", s)

    def _analyser_passwords(self):
        table_names = [
            ("ad_user", ["name", "domain"]),
            (
                "windows_user",
                [
                    "user",
                ],
            ),
            ("password", []),
        ]
        for table_name, fields in table_names:
            for entry in self.cyberdb.request(
                table_name, password__isnull=False
            ).exclude(password=""):

                password = entry.password
                entropy, reasons, severity = self._analyse_password(
                    password, entry, fields
                )
                if (
                    entropy < self.SEVERITY_LOW_ENTROPY
                    or self.REASON_KNOWN_WORD in reasons
                ):
                    password_is_weak = True
                else:
                    password_is_weak = False

                if table_name == "password":
                    location = None
                else:
                    location = str(entry)

                self.control(
                    "auth.password.weak",
                    # TODO: later add reference to the object
                    details={
                        "location": location,
                        "password": password,
                        "reasons": reasons,
                        "entropy": entropy,
                    },
                ).ko(password_is_weak, confidence="certain", severity=severity)
