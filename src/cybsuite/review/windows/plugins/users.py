from cybsuite.review.windows import Metadata, WindowsReviewer


class UsersReviewer(WindowsReviewer):
    name = "users"
    metadata = Metadata(category="windows", description="Review users")
    files = {"get-localuser.json": "commands/get-localuser.json"}
    # TODO: move these checks to DatabaseScanner
    # TODO: check disabled users and 3 defaults accoutns Guest, DefaultAccount, WGA..
    controls = [
        "windows.users.built_in_admin_not_renamed",
        "windows.users.password_required",
        "windows.users.password_last_set",
    ]

    # TODO: other languages?
    BUILT_IN_ADMIN_NAMES = ["administrator", "administrateur"]

    # Password age threshold (1.5 years in days)
    PASSWORD_AGE_THRESHOLD_DAYS = 365 * 1.5

    def do_run(self, files):
        extract_date = self.context.extract_datetime
        hostname = self.context.hostname
        filepath = files["get-localuser.json"]
        data = self.load_json(filepath)

        for user in data:
            sid = user["SID"]["Value"]
            rid = sid.split("-")[-1]

            # Parse dates
            password_changeable_date = (
                self.parse_date_value(user.get("PasswordChangeableDate"))
                if user.get("PasswordChangeableDate")
                else None
            )
            password_last_set = (
                self.parse_date_value(user.get("PasswordLastSet"))
                if user.get("PasswordLastSet")
                else None
            )
            last_logon = (
                self.parse_date_value(user.get("LastLogon"))
                if user.get("LastLogon")
                else None
            )
            password_expires = (
                self.parse_date_value(user.get("PasswordExpires"))
                if user.get("PasswordExpires")
                else None
            )

            self.feed(
                "windows_user",
                host=hostname,
                name=user["Name"],
                rid=rid,
                sid=sid,
                account_expires=user.get("AccountExpires"),
                description=user.get("Description"),
                enabled=user.get("Enabled"),
                full_name=user.get("FullName"),
                password_changeable_date=password_changeable_date,
                password_expires=password_expires,
                user_may_change_password=user.get("UserMayChangePassword"),
                password_required=user.get("PasswordRequired"),
                password_last_set=password_last_set,
                last_logon=last_logon,
            )
            # Controls for Built-in Administrator (RID 500)
            if rid == "500":
                self.control(
                    "windows.users.built_in_admin_not_renamed",
                    details={"user": user["Name"]},
                ).ok(
                    user["Name"].lower() not in self.BUILT_IN_ADMIN_NAMES,
                    confidence="certain",
                    justification="Checked RID 500 (built-in Administrator) name with command Get-LocalUser",
                )

            # Control for password requirement
            self.control(
                "windows.users.password_required",
                details={
                    "user": user["Name"],
                    "password_required": user.get("PasswordRequired"),
                },
            ).ok(
                user.get("PasswordRequired", True),
                confidence="certain",
                justification=f"Status checked with Get-LocalUser command",
            )

            # Control for password age
            self._check_password_age(user, extract_date, password_last_set)

    def _check_password_age(self, user, extract_date, password_last_set_date):
        """Check if password is too old (more than 1.5 years)"""
        control = self.control("windows.users.password_last_set")

        if not password_last_set_date:
            return

        delta_days = (extract_date - password_last_set_date).days

        control.details = {
            "user": user["Name"],
            "password_last_set": str(password_last_set_date),
            "days_old": delta_days,
        }

        control.ko(
            status=delta_days >= self.PASSWORD_AGE_THRESHOLD_DAYS,
            confidence="certain",
            justification=f"Password age checked for user with Get-LocalUser command",
        )
