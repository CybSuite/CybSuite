#!/bin/bash
# ================================================ #
# CybSuite - Linux Configuration Extraction Script #
# ================================================ #


# Global Variables #
# ================ #
# Colors
RED="\033[31;1m"
GREEN="\033[32;1m"
YELLOW="\033[33;1m"
RST="\033[0m"


# Utils Functions #
# =============== #
# Print functions
print-info() {
    echo -e "${GREEN}[INFO]${RST} $1"
}
print-warning() {
    echo -e "${YELLOW}[WARNING] $1 ${RST}"
}
print-error() {
    echo -e "${RED}[ERROR] $1 ${RST}"
}


# Check root privileges
if [[ $EUID -ne 0 ]]; then
    print-warning "The extraction is running without SUDO privileges. Script will give less results."
fi

# Prepare variables #
export PATH=${PATH}:/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Variables
HOSTNAME=$(hostname)
DATE="$(date -u +%Y-%m-%d_%H-%M-%S)"
extract_path="${HOSTNAME}_${DATE}"
extract_path_compressed="${extract_path}.tar.gz"

# Check if the extract_path exists
if [ -d "$extract_path" ]; then
    print-info "Directory $extract_path already exists. Exiting."
    exit 1
else
    print-info "Creating directory $extract_path."
    mkdir -p "$extract_path"
fi

# Setup logging
LOG_FILE="$extract_path/linux_extract.log"
exec > >(tee -a "$LOG_FILE") 2>&1

print-info "Extracting with cybsuite review script"

# Create directories
files_path="$extract_path/files/"
commands_path="$extract_path/commands/"
consolidated_path="$extract_path/consolidated/"
mkdir $files_path
mkdir $commands_path
mkdir $consolidated_path

# Create info.json with proper JSON formatting
cat > $extract_path/info.json << EOF
{
  "type": "linux",
  "name": "$HOSTNAME",
  "datetime": "$DATE"
}
EOF

# EXTRACTIONS #
# =========== #
# Copying files
mkdir -p "$files_path/etc"

print-info "Copying /etc folder"
cp -r /etc/ $files_path 2>/dev/null

print-info "Copying /var/spool/cron folder"
mkdir -p "$files_path/var/spool"
cp -r /var/spool/cron/ "$files_path/var/spool/" 2>/dev/null

print-info "Copying package management files"
mkdir -p "$files_path/var/lib/dpkg"
cp /var/lib/dpkg/status "$files_path/var/lib/dpkg/status" 2>/dev/null

print-info "Copying /boot/grub folder"
mkdir -p "$files_path/boot"
cp -r /boot/grub/ "$files_path/boot/" 2>/dev/null

# Start filesystem listing in background after extractions
print-info "Starting recursive filesystem listing in background"
find / -fstype nfs -prune \
    -o -path '/proc' -prune \
    -o -path '/dev' -prune \
    -o -path '/sys' -prune \
    -o -ls > "$commands_path/find_-ls.txt" 2>/dev/null &
PID_FIND=$!
print-info "filesystem listing started in background (PID: $PID_FIND)"

# Start capabilities scan in background
print-info "Starting capabilities scan in background"
getcap -r / > "$commands_path/getcap_-r.txt" 2>/dev/null &
PID_GETCAP=$!
print-info "capabilities scan started in background (PID: $PID_GETCAP)"


# Commands
df -a > "$commands_path/df_-a.txt"
df -ah > "$commands_path/df_-ah.txt"
free > "$commands_path/free.txt"
getent passwd > "$commands_path/getent_passwd.txt"
getent group > "$commands_path/getent_group.txt"
getent shadow > "$commands_path/getent_shadow.txt"
groups > "$commands_path/groups.txt"
hostname > "$commands_path/hostname.txt"
id > "$commands_path/id.txt"

lsb_release -a > "$commands_path/lsb_release_-a.txt"
lsof -v > "$commands_path/lsof_-v.txt"
netstat -antp > "$commands_path/netstat_-antp.txt"
ps aux > "$commands_path/ps_aux.txt"
uname > "$commands_path/uname.txt"
uptime > "$commands_path/uptime.txt"
umask > "$commands_path/umask.txt"
whoami > "$commands_path/whoami.txt"
mount -lv > "$commands_path/mount_-lv.txt"
lsblk > "$commands_path/lsblk.txt"
fdisk -l > "$commands_path/fdisk_-l.txt"
lsmod > "$commands_path/lsmod.txt"
lspci -v > "$commands_path/lspci_-v.txt"
w > "$commands_path/w.txt"
env > "$commands_path/env.txt"
last > "$commands_path/last.txt"
last -a > "$commands_path/last_-a.txt"
last -x > "$commands_path/last_-x.txt"
lastlog > "$commands_path/lastlog.txt"
swapon > "$commands_path/swapon.txt"
systemctl list-timers --all > "$commands_path/systemctl_list-timers_--all.txt"
dpkg -l > "$commands_path/dpkg_-l.txt"
rpm -qa > "$commands_path/rpm_-qa.txt" 2>/dev/null
yum list installed > "$commands_path/yum_list_installed.txt" 2>/dev/null
snap list > "$commands_path/snap_list.txt" 2>/dev/null
mokutil --sb-state > "$commands_path/mokutil_--sb-state.txt" 2>/dev/null
efibootmgr -v > "$commands_path/efibootmgr_-v.txt" 2>/dev/null

# Networking
print-info "Extract networking information"
ip a > "$commands_path/ip_a.txt"
lsof -i > "$commands_path/lsof_-i.txt"
route -n > "$commands_path/route_-n.txt"
route -6n > "$commands_path/route_-6n.txt"
iptables -L -n -v > "$commands_path/iptables_-L-n-v"
ip6tables -L -n -v > "$commands_path/ip6tables_-L-n-v"
iptables-save > "$commands_path/iptables-save.txt"
ip6tables-save > "$commands_path/ip6tables-save.txt"

# Docker
print-info "Extract Docker information"
docker ps -a > "$commands_path/docker_ps_-a.txt" 2>/dev/null
docker images > "$commands_path/docker_images.txt" 2>/dev/null
docker network ls > "$commands_path/docker_network_ls.txt" 2>/dev/null
docker volume ls > "$commands_path/docker_volume_ls.txt" 2>/dev/null
docker system df > "$commands_path/docker_system_df.txt" 2>/dev/null
docker version > "$commands_path/docker_version.txt" 2>/dev/null
docker info > "$commands_path/docker_info.txt" 2>/dev/null

# User SSH keys analysis
print-info "Extracting users info"
mkdir -p "$consolidated_path/users"

# Get all users from /etc/passwd
while IFS=: read -r username _ _ _ _ home_dir _; do
    if [ -d "$home_dir/.ssh" ]; then
        print-info "Extracting info for user: $username"
        mkdir -p "$consolidated_path/users/$username/.ssh"

        # Calculate SHA256 for each file in .ssh directory
        for ssh_file in "$home_dir/.ssh"/*; do
            if [ -f "$ssh_file" ]; then
                filename=$(basename "$ssh_file")
                sha256sum "$home_dir/.ssh/$filename" > "$consolidated_path/users/$username/.ssh/${filename}.sha256sum" 2>/dev/null
            fi
        done

        # Copy SSH files to files_path (normal copy)
        mkdir -p "$files_path$home_dir/.ssh"
        if [ -f "$home_dir/.ssh/authorized_keys" ]; then
            cp "$home_dir/.ssh/authorized_keys" "$files_path$home_dir/.ssh/authorized_keys" 2>/dev/null
        fi
        if [ -f "$home_dir/.ssh/known_hosts" ]; then
            cp "$home_dir/.ssh/known_hosts" "$files_path$home_dir/.ssh/known_hosts" 2>/dev/null
        fi
    fi
done < /etc/passwd

# Wait for background commands to complete
print-info "Waiting for background commands to complete..."
wait $PID_FIND
wait $PID_GETCAP


# Compress results and remove folder
print-info "Compress extractions to $extract_path_compressed"
tar -czf "$extract_path_compressed" "$extract_path"
rm -rf "$extract_path"
