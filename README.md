# Xterm client for OS.js

This is a [xterm.js](https://github.com/sourcelair/xterm.js) application for OS.js.

Connects to the OS.js server via SSH.

## Requirements

You'll need **bash** and **ssh** installed (for all platforms).

## Installation

```
./bin/add-package.sh xterm Xterm https://github.com/os-js/osjs-xterm.git
```

## SSL

When SSL is required, enable it in the settings.

```
node osjs config:set --name=client.Xterm.SSL --value=true
node osjs config:set --name=client.Xterm.SSLCert --value=/path/to/cert.pem
node osjs config:set --name=client.Xterm.SSLKey --value=/path/to/key.pem
```

Then rebuilt the config and restart OS.js.

```
node osjs build:config
```

## About

When launched, it takes the logged in user in OS.js and tries to log on to the local server via SSH.

## License

MIT
