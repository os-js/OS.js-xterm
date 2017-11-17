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
const uuidv4 = require('uuid/v4');

let PORT;
let terminals = {};
let userMap = {};
let server;

const createClient = (username, opts, ws) => {
  const cols = parseInt(opts.cols, 10) || 80;
  const rows = parseInt(opts.rows, 10) || 24;
  const args = ['-c', 'ssh ' + username + '@localhost'];

  const term = pty.spawn('bash', args, {
    cols,
    rows,
    name: 'xterm-color',
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

module.exports.destroy = function() {
  Object.keys(terminals).forEach((k) => {
    if ( terminals[k] ) {
      terminals[k].kill();
    }
  });

  if ( server ) {
    server.close();
    server = null;
  }

  terminals = {};

  return Promise.resolve(true);
};

module.exports.register = function(env, metadata, servers) {
  PORT = servers.http.address().port + 1;
  server = new WebSocket.Server({
    port: PORT
  });

  server.on('connection', (ws) => {
    let pinged = false;
    ws.on('message', (uuid) => {
      if ( !pinged ) {
        const term = createClient(userMap[uuid], {}, ws);
        if ( term ) {
          console.log('> New PTY on', term.pid);
        }

        pinged = true;
      }
    });
  });

  console.log('> Starting Xterm server on port', PORT);

  return Promise.resolve(true);
};

module.exports.api = {
  connect: (env, http, args) => {
    const username = args.username || http.session.get('username');
    const port = args.port || PORT;
    const uri = (args.secure ? 'wss' : 'ws') + '://' + args.hostname + ':' + port;
    const uuid = uuidv4();

    console.log('>', username, 'requested new pty on', uri);

    userMap[uuid] = username;

    return Promise.resolve({
      uri,
      uuid
    });
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

