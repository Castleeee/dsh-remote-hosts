set -eu
task_pid=
control_pid=
installation_directory=
stop_tree() {
  kill -STOP "$1" 2>/dev/null || return 0
  for descendant in $(ps -axo pid=,ppid= | awk -v parent="$1" '$2 == parent {print $1}'); do
    stop_tree "$descendant"
  done
  kill -KILL "$1" 2>/dev/null || true
}
cleanup() {
  trap - EXIT HUP INT TERM
  if [ -n "$control_pid" ]; then kill "$control_pid" 2>/dev/null || true; fi
  if [ -n "$task_pid" ]; then stop_tree "$task_pid"; fi
  if [ -n "$installation_directory" ]; then rm -rf "$installation_directory"; fi
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
exec 3<&0
script=$1
shift
sh -c "$script" sh "$@" </dev/null 3<&- &
task_pid=$!
installation_directory="$HOME/.local/share/dsh-remote-hosts/install-$task_pid"
supervisor=$$
(
  read -r command || true
  kill -TERM "$supervisor" 2>/dev/null || true
) <&3 &
control_pid=$!
result=0
wait "$task_pid" || result=$?
task_pid=
exit "$result"
