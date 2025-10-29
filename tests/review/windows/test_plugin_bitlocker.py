from cybsuite.review import ReviewManager

from .utils import get_data_path


def test_plugin_bitlocker(new_cyberdb):
    plugin_name = "bitlocker"

    review_manager = ReviewManager(
        cyberdb=new_cyberdb,
        plugins_names=[plugin_name],
    )

    review_manager.review_files(
        {"get-bitlockervolume.json": get_data_path("bitlocker_volumes.json")}
    )

    new_cyberdb.feed(
        "control",
        control_definition="windows.bitlocker3",
        details={"mount_point": "C:"},
        status="ok",
        confidence="certain",
        justification="Check if 'Get-BitLockerVolume' returned EncryptionMethod that is not null.",
        severity=None,
    )

    controls = new_cyberdb.get_controls("windows.bitlocker")
    assert len(controls) == 1

    control = controls[0]
    assert control.details["mount_point"] == "C:"
    assert control.status == "ok"
