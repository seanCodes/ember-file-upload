import Ember from 'ember';
import trim from './trim';

const { RSVP } = Ember;

function getHeader(headers, header) {
  let headerKeys = Object.keys(headers);
  let headerIdx = headerKeys.map((key) => key.toLowerCase()).indexOf(header.toLowerCase());
  if (headerIdx !== -1) {
    return headers[headerKeys[headerIdx]];
  }
  return null;
}

function parseResponse(request) {
  var body = trim(request.responseText);
  var rawHeaders = request.getAllResponseHeaders().split(/\n|\r/).filter(function (header) {
    return header !== '';
  });

  var headers = rawHeaders.reduce(function (E, header) {
    var parts = header.split(/^([0-9A-Za-z_-]*:)/);
    if (parts.length > 0){
      E[parts[1].slice(0, -1)] = trim(parts[2]);
    }
    return E;
  }, {});

  let contentType = (getHeader(headers, 'Content-Type') || '').split(';');

  // Parse body according to the Content-Type received by the server
  if (contentType.indexOf('text/html') !== -1) {
    body = Ember.$.parseHTML(body);
  } else if (contentType.indexOf('text/xml') !== -1) {
    body = Ember.$.parseXML(body);
  } else if (contentType.indexOf('application/json') !== -1 ||
             contentType.indexOf('text/javascript') !== -1 ||
             contentType.indexOf('application/javascript') !== -1) {
    body = Ember.$.parseJSON(body);
  }

  return {
    status: request.status,
    body: body,
    headers: headers
  };
}

export default function () {
  let { resolve, reject, promise } = RSVP.defer();
  let request = new XMLHttpRequest();

  let aborted = RSVP.defer();
  promise.cancel = () => {
    request.abort();
    return aborted.promise;
  };
  request.onabort = function () {
    this.onabort();
    aborted.resolve();
  };

  this.setRequestHeader = function (header, value) {
    request.setRequestHeader(header, value);
  };

  this.open = function (method, url, _, username='', password='') {
    request.open(method, url, true, username, password);
  };

  this.send = function (data) {
    request.send(data);
    return promise;
  };

  this.onprogress = this.onprogress || function () {};
  this.ontimeout = this.ontimeout || function () {};
  this.onabort = this.onabort || function () {};

  request.onloadstart = request.onprogress = request.onloadend = (evt) => {
    this.onprogress(evt);
  };

  request.onload = function () {
    let response = parseResponse(request);
    if (Math.floor(response.status / 200) === 1) {
      resolve(response);
    } else {
      reject(response);
    }
  };

  request.onerror = function () {
    reject(parseResponse(request));
  };


  Object.defineProperty(this, 'timeout', {
    get() {
      return request.timeout;
    },
    set(timeout) {
      request.timeout = timeout;
    },
    enumerable: true,
    configurable: false
  });

  request.ontimeout = () => {
    this.ontimeout();
    reject(parseResponse(request));
  };
}
