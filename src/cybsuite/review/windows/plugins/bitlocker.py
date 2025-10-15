from cybsuite.review.windows import Metadata, WindowsReviewer


# TODO:pourquoi un arg files? pourquoi pas directe .get_file?
class BitlockerReviewer(WindowsReviewer):
    name = "bitlocker"
    metadata = Metadata(category="windows", description="Review Bitlocker")
    files = {
        "get-bitlockervolume.json": "commands/get-bitlockervolume.json",
        "bitlocker_manage_bde_status.txt": "commands/bitlocker_manage_bde_status.txt",
    }
    controls = ["windows.bitlocker"]

    def do_run(self, files):
        # Check if BitLocker files exist
        bitlocker_volumes_file = files.get("get-bitlockervolume.json")
        bitlocker_manage_bde_file = files.get("bitlocker_manage_bde_status.txt")

        if not (bitlocker_volumes_file and bitlocker_volumes_file.exists()) and not (
            bitlocker_manage_bde_file and bitlocker_manage_bde_file.exists()
        ):
            control = self.control("windows.bitlocker")
            control.not_applicable(
                justification="File not found, probably because the cmdlet is not installed and maybe BitLocker is not available either"
            )
            return

        # Process BitLocker volumes if available
        if bitlocker_volumes_file and bitlocker_volumes_file.exists():
            bitlocker_volumes = self.load_json(bitlocker_volumes_file)
            for bitlocker_volume in bitlocker_volumes:
                # Check for each volume if Bitlocker is enabled
                mount_point = bitlocker_volume["MountPoint"]
                control = self.control(
                    "windows.bitlocker",
                    details={"mount_point": mount_point},
                )

                control.ok(
                    bitlocker_volume["EncryptionMethod"] is not None,
                    confidence="certain",
                    justification="Check if 'Get-BitLockerVolume' returned EncryptionMethod that is not null.",
                )

        # TODO: Check Encryption Method?
