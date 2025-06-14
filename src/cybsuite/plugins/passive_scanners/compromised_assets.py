from cybsuite.cyberdb import BasePassiveScanner, Metadata


class CompromisedAssetsScanner(BasePassiveScanner):
    name = "compromised_assets"
    metadata = Metadata(
        description="Search for compromised assets.",
        tags=['default'],
    )

    controls = ["compromised:ad_user"]

    def do_run(self):
        for ad_user in self.cyberdb.request('ad_user', password__isnull=False, _connector='OR', ntlm__isnull=False):
            details = {
                "user": ad_user.name,
                "domain": str(ad_user.domain),
                "password": ad_user.password,
                "lm": ad_user.lm,
                "ntlm": ad_user.ntlm,
            }
            self.alert("compromised:ad_user", details=details, confidence="certain", severity="high")
