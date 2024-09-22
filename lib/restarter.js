const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

class Restarter {
  constructor(service, app, scriptPath) {
    this.service = service // e.g. 'nodered.service'
    this.app = app // e.g. 'node-red'
    this.scriptPath = scriptPath 
    this.tmpFilePath = path.join('/tmp', 'restart_' + this.app)
    this.createStartScriptIfNotExists()
  }

  restart() {
    const platform = os.platform()
    if (platform !== 'linux') return

    this.isServiceRunning(this.service, (isRunning) => {
      if (isRunning) {
        exec('sudo systemctl restart ' + this.service, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error on service restart: ${error.message}`)
            return
          }
          if (stderr) {
            console.error(`stderr: ${stderr}`)
            return;
          }
          console.log(`stdout: ${stdout}`)
        })
      } else {
        this.stopProcess()
      }
    })
  }

  isServiceRunning(serviceName, callback) {
    exec(`systemctl is-active ${serviceName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error checking service status: ${error.message}`)
        return callback(false)
      }
      callback(stdout.trim() === 'active')
    })
  }

  createStartScriptIfNotExists() {
    // Shell script content
    const scriptContent = `#!/bin/bash
echo "Script running..."

start_process() {
  echo "Starting ${this.app}..."
  ${this.app} &
}

stop_process() {
  echo "Stopping script..."
  pkill -f ${this.app}
  exit 0
}

# Trap for SIGINT und SIGTERM, to stop ${this.app} when script ended
#trap "stop_process" SIGINT SIGTERM

restart_process_if_needed() {
  if [[ -f ${this.tmpFilePath} ]]; then
    echo "${this.tmpFilePath} found. Restarting ${this.app}..."
    rm ${this.tmpFilePath}
    start_process
    sleep 10
  else
    echo "${this.tmpFilePath} not exist. Exiting."
    exit 0
  fi
}

is_process_running() {
  pgrep -f "${this.app}" | grep -v $$ > /dev/null
}

# Start ${this.app} if it's not already running
if ! is_process_running; then
  start_process
fi

# Endless loop for monitoring
while true; do
  # Wait until ${this.app} ends
  if ! is_process_running; then
    echo "${this.app} stopped."
    sleep 3
    restart_process_if_needed
  fi
  sleep 5
done
`
    // Check if the script already exists
    if (!fs.existsSync(this.scriptPath)) {
      const scriptDir = path.dirname(this.scriptPath)
      // Ensure the script directory exists
      if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true })
      }

      // Write the shell script to the specified path
      fs.writeFileSync(this.scriptPath, scriptContent, { mode: 0o755 }) // 755 gives execution rights
      console.log('Restart script created at:', this.scriptPath)
    }
  }

  stopProcess() {
    console.log('stopProcess ' + this.app)
    fs.writeFileSync(this.tmpFilePath, 'true')
    exec('pkill -f ' + this.app)
  }
}

module.exports = Restarter