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
import Terminal from 'xterm';

const Application = OSjs.require('core/application');
const Window = OSjs.require('core/window');

class ApplicationXtermWindow extends Window {

  constructor(app, metadata) {
    super('ApplicationXtermWindow', {
      icon: metadata.icon,
      title: metadata.name,
      width: 400,
      height: 200
    }, app);

    this.term = new Terminal();
  }

  init(wmRef, app) {
    const root = super.init(...arguments);

    Terminal.loadAddon('fit');
    Terminal.loadAddon('attach');

    const terminalRoot = document.createElement('div');
    root.appendChild(terminalRoot);
    this.term.open(terminalRoot);
    this.term.fit();

    this._on('resized,maximize,restore', () => {
      this.term.fit();
      this.term.focus();
    });

    this._on('moved', () => this.term.focus());
    this._on('focus', () => this.term.focus());
    this._on('blur', () => this.term.blur());

    return root;
  }

}

class ApplicationXterm extends Application {

  constructor(args, metadata) {
    super('ApplicationXterm', args, metadata);
    this.ws = null;
  }

  destroy() {
    if ( this.ws ) {
      this.ws.close();
    }
    this.ws = null;
    this.pid = null;

    return super.destroy(...arguments);
  }

  createConnection() {
    return new Promise((resolve, reject) => {
      this._api('connect', {}).then((uri) => {
        let pinged = false;

        this.ws = new WebSocket(uri);

        this.ws.onmessage = (ev) => {
          if ( !pinged ) {
            this.pid = parseInt(ev.data, 10);
            pinged = true;

            resolve(uri);
          }
        };

        return true;
      }).catch(reject);
    });
  }

  resizeTerminal(cols, rows) {
    return this._api('resize', {pid: this.pid, cols, rows});
  }

  init(settings, metadata) {
    super.init(...arguments);

    const win = new ApplicationXtermWindow(this, metadata);

    win._on('inited', () => {
      const term = win.term;

      term.writeln('');
      term.writeln('...TRYING TO CONNECT...');
      term.writeln('');

      this.createConnection().then((uri) => {

        console.info('A Xterm session was opened on pid', this.pid);
        if ( this.ws ) {
          win._setTitle(this.pid, true);

          term.attach(this.ws);
          /* TODO
          term.on('bell', () => {

          });
          */

          term.on('resize', (size) => {
            this.resizeTerminal(size.cols, size.rows);
          });

          this.ws.onclose = () => {
            term.clear();
            term.writeln('');
            term.writeln('...CONNECTION WAS LOST...');
            term.writeln('');
          };

          term.focus();
        }
      });
    });

    this._addWindow(win);
  }
}

OSjs.Applications.ApplicationXterm = ApplicationXterm;
