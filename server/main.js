/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2017, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */
const pty = require('node-pty');
const WebSocket = require('ws');
const os = require('os');

const isWin = os.platform === 'win32';
const execTerm = isWin ? 'cmd.exe' : 'bash';

let port;
let terminals = {};
let server;

const createClient = (opts, ws) => {
  const cols = parseInt(opts.cols, 10) || 80;
  const rows = parseInt(opts.rows, 10) || 24;

  const term = pty.spawn(execTerm, [], {
    name: 'xterm-color',
    cols,
    rows,
    cwd: process.env.PWD,
    env: process.env
  });

  const pid = term.pid;

  ws.send(String(pid));

  terminals[pid] = term;

  term.on('data', (data) => {
    try {
      ws.send(data);
    } catch ( e ) {}
  });

  ws.on('message', (data) => {
    term.write(data);
  });

  ws.on('close', () => {
    console.log('< Closing websocket connection on', pid);
    term.kill();

    delete terminals[pid];
  });

  return term;
};

module.exports.register = function(env, metadata, servers) {
  port = servers.http.address().port + 1;
  server = new WebSocket.Server({
    port
  });

  server.on('connection', (ws) => {
    const term = createClient({}, ws);
    console.log('> New websocket connection with', term.pid);
  });

  console.log('> Starting Xterm server on port', port);

  return Promise.resolve(true);
};

module.exports.api = {
  connect: (env, http, args) => {
    return Promise.resolve('ws://localhost:' + port);
  },
  resize: (env, http, args) => {
    const pid = parseInt(args.pid, 10);
    const cols = parseInt(args.cols, 10) || 80;
    const rows = parseInt(args.rows, 10) || 24;

    if ( terminals[pid] ) {
      terminals[pid].resize(cols, rows);
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }
};

