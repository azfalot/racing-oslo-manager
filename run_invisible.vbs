Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\racing-oslo-manager"
WshShell.Run "node src/daemon.js", 0, False
