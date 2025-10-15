# ================================================== #
# CybSuite - Windows Configuration Extraction Script #
# ================================================== #

# ==================== #
# Script Configuration #
# ==================== #

# If property dont exists in object, raise error
Set-StrictMode -Version Latest

# Set culture to en-US to avoid issues with dates
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::CreateSpecificCulture("en-US")
[System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::CreateSpecificCulture("en-US")

# TODO: FileSystem files and permissions
# TODO: (Get-CimInstance Win32_OperatingSystem).InstallDate

# =============== #
# UTILS FUNCTIONS #
# =============== #

function print_info {
    param([string]$message)
    Write-Host "[i] " -NoNewline -ForegroundColor Green
    Write-Host $message
}

function print_error {
    param([string]$message)
    Write-Host "[ERROR] " -NoNewline -ForegroundColor Red
    Write-Host $message
}


function AsJson {
    # Same as using ConvertTo-Json -Array but compatible with lower powershell versions
    param (
        [Parameter(ValueFromPipeline = $true, Mandatory = $true)]
        $InputObject,

        [Parameter(Mandatory = $false)]
        [int]$Depth = 5
    )


    # Collect input objects into an array
    begin
    {
        $collectedInput = @()
    }


    process {
        $collectedInput += $InputObject
    }

    end {
        # Convert the collected objects to JSON
        $jsonOutput = $collectedInput | ConvertTo-Json -Depth $Depth

        if (-not $jsonOutput.StartsWith('[')) {
            $jsonOutput = "[`n$jsonOutput`n]"
        }

        # Output the JSON
        $jsonOutput
    }

}

function Export-AllFormats {
    # Export data in JSON, CSV and TXT formats
    param (
        [Parameter(ValueFromPipeline = $true, Mandatory = $true)]
        $InputObject,

        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    # Collect input objects into an array
    begin {
        $collectedInput = @()
    }

    process {
        $collectedInput += $InputObject
    }

    end {
        # Export as JSON
        $collectedInput | AsJson | Out-File -FilePath "${FilePath}.json" -Encoding utf8

        # Export as CSV
        $collectedInput | ConvertTo-Csv -NoTypeInformation | Out-File -FilePath "${FilePath}.csv" -Encoding utf8

        # Export as TXT (formatted table)
        $collectedInput | Format-Table -AutoSize | Out-File -FilePath "${FilePath}.txt" -Encoding utf8
    }
}

# ================== #
# EXTRACTS FUNCTIONS #
# ================== #



# ================ #
# Global variables #
# ================ #


$hostname = $env:COMPUTERNAME
$currentDir = Get-Location
$dateObj = (Get-Date).ToUniversalTime()
$date = $dateObj.ToString("o") # ISO 8601 format
$dateStr = $dateObj.ToString("yyyy-MM-dd_HH-mm-ss")
$extractPath = "${hostname}_${dateStr}"
$dirExtracts = Join-Path $currentDir $extractPath
$dirCommands = Join-Path $dirExtracts "commands"
$dirFiles = Join-Path $dirExtracts "files"
$infoJsonPath = Join-Path $dirExtracts "info.json"
$outputZip = Join-Path $currentDir "${extractPath}.zip"
$logFile = Join-Path $dirExtracts "script.log"
$startTime = Get-Date



# ======================= #
# CLI PARAMETERS & CHECKS #
# ======================= #
# TODO: Fix CLI args --force
#param(
#    [switch]$Force
#)

# If force remove current folder
#if ($Force) {
#    if (Test-Path $dirExtracts) {
#        print_info "Forcing removal of existing 'cbs_extracts' folder ..."
#        Remove-Item -Path $dirExtracts -Recurse -Force
#    }
#}

# Check if base folder exists
if (Test-Path $dirExtracts) {
    print_error "Folder '$dirExtracts' already exists. Use --force to remove it."
    exit 1
}


# Create directories
print_info "Creating folders"
New-Item -ItemType Directory -Path $dirExtracts -Force | Out-Null
New-Item -ItemType Directory -Path $dirCommands -Force | Out-Null
New-Item -ItemType Directory -Path $dirFiles -Force | Out-Null

# Start transcript to capture all output
Start-Transcript -Path $logFile -Append -Force

print_info "Extracting with cybsuite review script"

# Create info.json file
# ---------------------
print_info "Extracting metadata for review"
# Create the JSON object
$info = @{
    type = "windows"
    name = $hostname
    datetime = $date
}
# Convert to JSON and save to the specified file
$info | ConvertTo-Json -Depth 2 | Out-File -FilePath $infoJsonPath -Encoding UTF8



# ================ #
# EXTRACTING CONFS #
# ================ #

# ======================= #
# SYSTEM INFORMATION      #
# ======================= #
print_info "=== SYSTEM INFORMATION SECTION ==="

print_info "Extracting systeminfo"
systeminfo | Out-File -FilePath "$dirCommands\systeminfo.txt" -Encoding utf8

print_info "Extracting computer information"
Get-ComputerInfo | Export-AllFormats -FilePath "$dirCommands\get-computerinfo"

print_info "Extracting computer system info"
Get-WmiObject Win32_ComputerSystem | Export-AllFormats -FilePath "$dirCommands\get-wmiobject-win32_computersystem"

print_info "Extracting OS version (WMI)"
wmic os get version | Out-File -FilePath "$dirCommands\wmic_os_version.txt" -Encoding utf8

print_info "Extracting environment variables"
Get-ChildItem Env: | Export-AllFormats -FilePath "$dirCommands\get-childitem-env"

# ======================= #
# USER & GROUP MANAGEMENT #
# ======================= #
print_info "=== USER & GROUP MANAGEMENT SECTION ==="

print_info "Extracting local users"
Get-LocalUser | Export-AllFormats -FilePath "$dirCommands\get-localuser"

print_info "Extracting local groups"
Get-LocalGroup | Export-AllFormats -FilePath "$dirCommands\get-localgroup"

print_info "Extracting local groups members for administrators"
$adminGroup = ([System.Security.Principal.SecurityIdentifier] "S-1-5-32-544").Translate([System.Security.Principal.NTAccount]).Value
$adminGroupName = ($adminGroup -split '\\')[-1]  # Extracts only the group name (e.g., "Administrateurs")
Get-LocalGroupMember -Group $adminGroupName | Export-AllFormats -FilePath "$dirCommands\local_groups_members_administrators"

print_info "Extracting local groups members"
$allGroupMembers = @()
foreach ($groupInfo in Get-LocalGroup) {
    $members = Get-LocalGroupMember -Group $groupInfo.Name

    # Ensure members is always an array
    if ($members -isnot [Array]) {
        $members = @($members)
    }

    $allGroupMembers += [PSCustomObject]@{
        group  = $groupInfo
        members = $members
    }
}
# Use -Depth to have full info of members and not just name
$allGroupMembers | Export-AllFormats -FilePath "$dirCommands\local_groups_members"

# ======================= #
# NETWORK CONFIGURATION   #
# ======================= #
print_info "=== NETWORK CONFIGURATION SECTION ==="

print_info "Extracting network adapters"
Get-NetAdapter | Export-AllFormats -FilePath "$dirCommands\get-netadapter"

print_info "Extracting network IP addresses"
Get-NetIPAddress | Export-AllFormats -FilePath "$dirCommands\get-netipaddress"

print_info "Extracting network routes"
Get-NetRoute | Export-AllFormats -FilePath "$dirCommands\get-netroute"

print_info "Extracting network connections"
netstat -an | Out-File -FilePath "$dirCommands\network_connections.txt" -Encoding utf8

print_info "Extracting ARP table"
arp -a | Out-File -FilePath "$dirCommands\arp_table.txt" -Encoding utf8

print_info "Extracting SMB shares"
Get-SmbShare | Export-AllFormats -FilePath "$dirCommands\get-smbshare"

print_info "Extracting SMB sessions"
Get-SmbSession | Export-AllFormats -FilePath "$dirCommands\get-smbsession"

print_info "Extracting proxy configuration"
netsh winhttp show proxy | Out-File -FilePath "$dirCommands\proxy_configuration.txt" -Encoding utf8

print_info "Extracting NTP configuration"
w32tm /query /configuration | Out-File -FilePath "$dirCommands\w32tm_ntp_configuration.txt" -Encoding utf8

print_info "Extracting NTP status"
w32tm /query /status | Out-File -FilePath "$dirCommands\w32tm_ntp_status.txt" -Encoding utf8

# ======================= #
# SECURITY & FIREWALL     #
# ======================= #
print_info "=== SECURITY & FIREWALL SECTION ==="

print_info "Extracting Windows Firewall rules"
Get-NetFirewallRule | Export-AllFormats -FilePath "$dirCommands\get-netfirewallrule"

print_info "Extracting Windows Firewall profiles"
Get-NetFirewallProfile | Export-AllFormats -FilePath "$dirCommands\get-netfirewallprofile"

print_info "Extracting firewall detailed status"
netsh advfirewall show allprofiles | Out-File -FilePath "$dirCommands\firewall_detailed_status.txt" -Encoding utf8

# ======================= #
# ENCRYPTION (BITLOCKER)  #
# ======================= #
print_info "=== ENCRYPTION (BITLOCKER) SECTION ==="

print_info "Extracting Bitlocker volumes"
Get-BitlockerVolume | Export-AllFormats -FilePath "$dirCommands\get-bitlockervolume"

print_info "Extracting Bitlocker status (manage-bde)"
manage-bde -status | Out-File -FilePath "$dirCommands\bitlocker_manage_bde_status.txt" -Encoding utf8

# ======================= #
# PROCESSES & SERVICES    #
# ======================= #
print_info "=== PROCESSES & SERVICES SECTION ==="

print_info "Extracting running processes"
Get-Process | Export-AllFormats -FilePath "$dirCommands\get-process"

print_info "Extracting processes (WMI)"
wmic process list | Out-File -FilePath "$dirCommands\wmic_process_list.txt" -Encoding utf8

print_info "Extracting scheduled tasks"
Get-ScheduledTask | Export-AllFormats -FilePath "$dirCommands\get-scheduledtask"

print_info "Extracting Windows services"
Get-Service | Export-AllFormats -FilePath "$dirCommands\get-service"

print_info "Extracting Windows services (CIM)"
Get-CimInstance Win32_Service | Export-AllFormats -FilePath "$dirCommands\get-ciminstance-win32_service"

print_info "Extracting system drivers"
Get-WmiObject Win32_SystemDriver | Export-AllFormats -FilePath "$dirCommands\get-wmiobject-win32_systemdriver"

# ======================= #
# ANTIVIRUS & DEFENDER    #
# ======================= #
print_info "=== ANTIVIRUS & DEFENDER SECTION ==="

print_info "Extracting Windows Defender state"
Get-MpComputerStatus | Export-AllFormats -FilePath "$dirCommands\get-mpcomputerstatus"

print_info "Extracting Windows Defender preferences"
Get-MpPreference | Export-AllFormats -FilePath "$dirCommands\get-mppreference"

# ======================= #
# APPLICATION CONTROL     #
# ======================= #
print_info "=== APPLICATION CONTROL SECTION ==="

print_info "Extracting AppLocker policies"
Get-AppLockerPolicy -Effective | Export-AllFormats -FilePath "$dirCommands\get-applockerpolicy"

print_info "Extracting AppLocker events"
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-AppLocker/EXE and DLL'; ID=8002,8003,8004} -MaxEvents 1000 -ErrorAction SilentlyContinue | Export-AllFormats -FilePath "$dirCommands\applocker_events"

# ======================= #
# CERTIFICATES            #
# ======================= #
print_info "=== CERTIFICATES SECTION ==="

print_info "Extracting personal certificates"
Get-ChildItem Cert:\LocalMachine\My | Export-AllFormats -FilePath "$dirCommands\certificates_personal"

print_info "Extracting root certificates"
Get-ChildItem Cert:\LocalMachine\Root | Export-AllFormats -FilePath "$dirCommands\certificates_root"

# ======================= #
# GROUP POLICIES          #
# ======================= #
print_info "=== GROUP POLICIES SECTION ==="

print_info "Extracting group policy results"
gpresult /r | Out-File -FilePath "$dirCommands\group_policy_results.txt" -Encoding utf8

# ======================= #
# SECURITY POLICIES       #
# ======================= #
print_info "=== SECURITY POLICIES SECTION ==="

# Require admin privileges
print_info "Extracting secedit"
secedit /export /cfg "$dirCommands/secedit.ini" > $null

print_info "Extracting auditpol"
auditpol /backup /file:"$dirCommands/auditpol.csv"

print_info "Extracting net accounts"
net accounts | Out-File -FilePath "$dirCommands\net_accounts.txt" -Encoding utf8

# ======================= #
# PASSWORD HASHES & SAM   #
# ======================= #
print_info "=== PASSWORD HASHES & SAM SECTION ==="

print_info "Dumping password hashes and SAM database (requires admin privileges)"
print_info "Saving SAM registry hive"
reg SAVE HKLM\SAM "$dirFiles\SAM.backup" 2>$null

print_info "Saving SECURITY registry hive"
reg SAVE HKLM\SECURITY "$dirFiles\SECURITY.backup" 2>$null

print_info "Saving SYSTEM registry hive"
reg SAVE HKLM\SYSTEM "$dirFiles\SYSTEM.backup" 2>$null


# ======================= #
# SECURITY EVENTS         #
# ======================= #
print_info "=== SECURITY EVENTS SECTION ==="

print_info "Extracting security events (logon events)"
Get-WinEvent -LogName Security -FilterHashtable @{ID=4624,4625} -MaxEvents 1000 -ErrorAction SilentlyContinue | Export-AllFormats -FilePath "$dirCommands\security_logon_events"

print_info "Extracting security events (privilege events)"
Get-WinEvent -LogName Security -FilterHashtable @{ID=4672} -MaxEvents 1000 -ErrorAction SilentlyContinue | Export-AllFormats -FilePath "$dirCommands\security_privilege_events"

print_info "Extracting system events (service events)"
Get-WinEvent -LogName System -FilterHashtable @{ID=7034,7035,7036} -MaxEvents 1000 -ErrorAction SilentlyContinue | Export-AllFormats -FilePath "$dirCommands\system_service_events"

print_info "Extracting application events (recent)"
Get-WinEvent -LogName Application -MaxEvents 500 -ErrorAction SilentlyContinue | Export-AllFormats -FilePath "$dirCommands\application_events"

print_info "Extracting system events (recent)"
Get-WinEvent -LogName System -MaxEvents 500 -ErrorAction SilentlyContinue | Export-AllFormats -FilePath "$dirCommands\system_events"

# ======================= #
# SOFTWARE & UPDATES      #
# ======================= #
print_info "=== SOFTWARE & UPDATES SECTION ==="

print_info "Extracting antivirus information"
$antivirus1 = Get-WmiObject -Namespace "root\SecurityCenter" -Query "SELECT * FROM AntiVirusProduct"
$antivirus2 = Get-WmiObject -Namespace "root\SecurityCenter2" -Query "SELECT * FROM AntiVirusProduct"
$antivirus = $antivirus1 + $antivirus2
$antivirus | Export-AllFormats -FilePath "$dirCommands\antivirus"

print_info "Extracting installed applications (registry)"
$applications = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
$applications | Export-AllFormats -FilePath "$dirCommands\applications_registry"

print_info "Extracting installed applications (WMI)"
$applications2 = Get-WmiObject Win32_product | Select-Object name, version
$applications2 | Export-AllFormats -FilePath "$dirCommands\applications_wmic"

print_info "Extracting installed applications (WMIC)"
wmic product get name | Out-File -FilePath "$dirCommands\wmic_installed_applications.txt" -Encoding utf8

print_info "Extracting HotFix"
Get-HotFix | Export-AllFormats -FilePath "$dirCommands\get-hotfix"

print_info "Extracting HotFix (WMI)"
wmic qfe list | Out-File -FilePath "$dirCommands\wmic_hotfix_list.txt" -Encoding utf8

# ======================= #
# REGISTRY EXTRACTION     #
# ======================= #
print_info "=== REGISTRY EXTRACTION SECTION ==="
print_info "Extracting registries... This might take some time, grab a coffee!"

$hives = @(
    "HKLM",
    "HKCU",
    "HKCR",
    "HKU",
    "HKCC"
)

foreach ($hive in $hives) {
    print_info "  extracting hive as txt $hive..."
    reg.exe export $hive "$dirCommands\reg_$hive.txt" > $null 2>&1
}

# This takes 30 minutes .. so do the compute in post review
foreach ($hive in $hives) {
    print_info "  extracting hive as json $hive..."
    Get-ChildItem "$($hive):\" -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        # Prepare an object to store key information
        $registryKeyData = @{
            path     = $_.Name
            properties = @{}
        }

        # Get registry values for each key
        $key = $_
        foreach ($valueName in $key.GetValueNames()) {
                $valueData = $key.GetValue($valueName)
                # Add each registry value to the properties hashtable
                $registryKeyData.properties[$valueName] = $valueData
            }

        # Convert the object to JSON and compress it
        $registryKeyData | ConvertTo-Json -Compress
    } | Out-File -FilePath "$dirCommands\reg_$hive.json" -Encoding utf8
}

if ($false) {
    # not working for the moment => takes muuuch time
    print_info "Extracting ACLs... This might take some time, grab a coffee!"
    Get-ChildItem / -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try{
            if (-Not (Test-Path "$($_.FullName)")) { return }

            $acl = Get-acl "$($_.FullName)"
            $sddl = $acl.GetSecurityDescriptorSddlForm('All')
            if ($sddl) {
                [PSCustomObject]@{
                    filename = $_.FullName
                    sddl = $sddl
                } | ConvertTo-Json -Compress
            }
        }catch   {
            echo "Skipping $_"
        }
    }  | Out-File -FilePath  -Encoding utf8 "$dirCommands\acls.json"
}

$endTime = Get-Date
$elapsedTime = $endTime - $startTime
print_info "Script execution time: $($elapsedTime.TotalSeconds) seconds /  $($elapsedTime.TotalMinutes) minutes"

# Stop transcript logging before compression
Stop-Transcript

# ==================== #
# COMPRESS EXTRACTIONS #
# ==================== #

if (Test-Path $outputZip) { Remove-Item $outputZip }
Compress-Archive -Path $dirExtracts -DestinationPath $outputZip

# Remove the original extraction directory after compression
print_info "Removing original extraction directory"
Remove-Item -Path $dirExtracts -Recurse -Force

print_info "Extracted and compressed to: $outputZip"
