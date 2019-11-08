'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isPlainText = isPlainText;
exports.convertAddresses = convertAddresses;
exports.parseAddresses = parseAddresses;
exports.encodeHeaderValue = encodeHeaderValue;
exports.normalizeHeaderKey = normalizeHeaderKey;
exports.generateBoundary = generateBoundary;
exports.escapeHeaderArgument = escapeHeaderArgument;
exports.buildHeaderValue = buildHeaderValue;

var _ramda = require('ramda');

var _emailjsAddressparser = require('emailjs-addressparser');

var _emailjsAddressparser2 = _interopRequireDefault(_emailjsAddressparser);

var _emailjsMimeCodec = require('emailjs-mime-codec');

var _punycode = require('punycode');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * If needed, mime encodes the name part
 *
 * @param {String} name Name part of an address
 * @returns {String} Mime word encoded string if needed
 */
/* eslint-disable node/no-deprecated-api */
/* eslint-disable no-control-regex */

function encodeAddressName(name) {
  if (!/^[\w ']*$/.test(name)) {
    if (/^[\x20-\x7e]*$/.test(name)) {
      return '"' + name.replace(/([\\"])/g, '\\$1') + '"';
    } else {
      return (0, _emailjsMimeCodec.mimeWordEncode)(name, 'Q');
    }
  }
  return name;
}

/**
 * Checks if a value is plaintext string (uses only printable 7bit chars)
 *
 * @param {String} value String to be tested
 * @returns {Boolean} true if it is a plaintext string
 */
function isPlainText(value) {
  return !(typeof value !== 'string' || /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/.test(value));
}

/**
 * Rebuilds address object using punycode and other adjustments
 *
 * @param {Array} addresses An array of address objects
 * @param {Array} [uniqueList] An array to be populated with addresses
 * @return {String} address string
 */
function convertAddresses() {
  var addresses = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var uniqueList = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  var values = [];[].concat(addresses).forEach(function (address) {
    if (address.address) {
      address.address = address.address.replace(/^.*?(?=@)/, function (user) {
        return (0, _emailjsMimeCodec.mimeWordsEncode)(user, 'Q');
      }).replace(/@.+$/, function (domain) {
        return '@' + (0, _punycode.toASCII)(domain.substr(1));
      });

      if (!address.name) {
        values.push(address.address);
      } else if (address.name) {
        values.push(encodeAddressName(address.name) + ' <' + address.address + '>');
      }

      if (uniqueList.indexOf(address.address) < 0) {
        uniqueList.push(address.address);
      }
    } else if (address.group) {
      values.push(encodeAddressName(address.name) + ':' + (address.group.length ? convertAddresses(address.group, uniqueList) : '').trim() + ';');
    }
  });

  return values.join(', ');
}

/**
 * Parses addresses. Takes in a single address or an array or an
 * array of address arrays (eg. To: [[first group], [second group],...])
 *
 * @param {Mixed} addresses Addresses to be parsed
 * @return {Array} An array of address objects
 */
function parseAddresses() {
  var addresses = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  return (0, _ramda.flatten)([].concat(addresses).map(function (address) {
    if (address && address.address) {
      address = convertAddresses(address);
    }
    return (0, _emailjsAddressparser2.default)(address);
  }));
}

/**
 * Encodes a header value for use in the generated rfc2822 email.
 *
 * @param {String} key Header key
 * @param {String} value Header value
 */
function encodeHeaderValue(key) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

  key = normalizeHeaderKey(key);

  switch (key) {
    case 'From':
    case 'Sender':
    case 'To':
    case 'Cc':
    case 'Bcc':
    case 'Reply-To':
      return convertAddresses(parseAddresses(value));

    case 'Message-Id':
    case 'In-Reply-To':
    case 'Content-Id':
      value = value.replace(/\r?\n|\r/g, ' ');

      if (value.charAt(0) !== '<') {
        value = '<' + value;
      }

      if (value.charAt(value.length - 1) !== '>') {
        value = value + '>';
      }
      return value;

    case 'References':
      value = [].concat.apply([], [].concat(value).map(function () {
        var elm = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        return elm.replace(/\r?\n|\r/g, ' ').trim().replace(/<[^>]*>/g, function (str) {
          return str.replace(/\s/g, '');
        }).split(/\s+/);
      })).map(function (elm) {
        if (elm.charAt(0) !== '<') {
          elm = '<' + elm;
        }
        if (elm.charAt(elm.length - 1) !== '>') {
          elm = elm + '>';
        }
        return elm;
      });

      return value.join(' ').trim();

    case 'Subject':
      return (0, _emailjsMimeCodec.mimeWordEncode)((value || '').toString().replace(/\r?\n|\r/g, ' '), 'B');
    default:
      return (0, _emailjsMimeCodec.mimeWordsEncode)((value || '').toString().replace(/\r?\n|\r/g, ' '), 'B');
  }
}

/**
 * Normalizes a header key, uses Camel-Case form, except for uppercase MIME-
 *
 * @param {String} key Key to be normalized
 * @return {String} key in Camel-Case form
 */
function normalizeHeaderKey() {
  var key = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

  return key.replace(/\r?\n|\r/g, ' ') // no newlines in keys
  .trim().toLowerCase().replace(/^MIME\b|^[a-z]|-[a-z]/ig, function (c) {
    return c.toUpperCase();
  }); // use uppercase words, except MIME
}

/**
 * Generates a multipart boundary value
 *
 * @return {String} boundary value
 */
function generateBoundary(nodeId, baseBoundary) {
  return '----sinikael-?=_' + nodeId + '-' + baseBoundary;
}

/**
 * Escapes a header argument value (eg. boundary value for content type),
 * adds surrounding quotes if needed
 *
 * @param {String} value Header argument value
 * @return {String} escaped and quoted (if needed) argument value
 */
function escapeHeaderArgument(value) {
  if (value.match(/[\s'"\\;/=]|^-/g)) {
    return '"' + value.replace(/(["\\])/g, '\\$1') + '"';
  } else {
    return value;
  }
}

/**
 * Joins parsed header value together as 'value; param1=value1; param2=value2'
 *
 * @param {Object} structured Parsed header value
 * @return {String} joined header value
 */
function buildHeaderValue(structured) {
  var paramsArray = [];

  Object.keys(structured.params || {}).forEach(function (param) {
    // filename might include unicode characters so it is a special case
    if (param === 'filename') {
      (0, _emailjsMimeCodec.continuationEncode)(param, structured.params[param], 50).forEach(function (encodedParam) {
        // continuation encoded strings are always escaped, so no need to use enclosing quotes
        // in fact using quotes might end up with invalid filenames in some clients
        paramsArray.push(encodedParam.key + '=' + encodedParam.value);
      });
    } else {
      paramsArray.push(param + '=' + escapeHeaderArgument(structured.params[param]));
    }
  });

  return structured.value + (paramsArray.length ? '; ' + paramsArray.join('; ') : '');
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyJdLCJuYW1lcyI6WyJpc1BsYWluVGV4dCIsImNvbnZlcnRBZGRyZXNzZXMiLCJwYXJzZUFkZHJlc3NlcyIsImVuY29kZUhlYWRlclZhbHVlIiwibm9ybWFsaXplSGVhZGVyS2V5IiwiZ2VuZXJhdGVCb3VuZGFyeSIsImVzY2FwZUhlYWRlckFyZ3VtZW50IiwiYnVpbGRIZWFkZXJWYWx1ZSIsImVuY29kZUFkZHJlc3NOYW1lIiwibmFtZSIsInRlc3QiLCJyZXBsYWNlIiwidmFsdWUiLCJhZGRyZXNzZXMiLCJ1bmlxdWVMaXN0IiwidmFsdWVzIiwiY29uY2F0IiwiZm9yRWFjaCIsImFkZHJlc3MiLCJ1c2VyIiwiZG9tYWluIiwic3Vic3RyIiwicHVzaCIsImluZGV4T2YiLCJncm91cCIsImxlbmd0aCIsInRyaW0iLCJqb2luIiwibWFwIiwia2V5IiwiY2hhckF0IiwiYXBwbHkiLCJlbG0iLCJzdHIiLCJzcGxpdCIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJjIiwidG9VcHBlckNhc2UiLCJub2RlSWQiLCJiYXNlQm91bmRhcnkiLCJtYXRjaCIsInN0cnVjdHVyZWQiLCJwYXJhbXNBcnJheSIsIk9iamVjdCIsImtleXMiLCJwYXJhbXMiLCJwYXJhbSIsImVuY29kZWRQYXJhbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7UUFtQ2dCQSxXLEdBQUFBLFc7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFpQ0FDLGMsR0FBQUEsYztRQWVBQyxpQixHQUFBQSxpQjtRQXlEQUMsa0IsR0FBQUEsa0I7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFXQUMsb0IsR0FBQUEsb0I7UUFjQUMsZ0IsR0FBQUEsZ0I7O0FBeExoQjs7QUFDQTs7OztBQUNBOztBQUtBOzs7O0FBRUE7Ozs7OztBQVpBO0FBQ0E7O0FBaUJBLFNBQVNDLGlCQUFULENBQTRCQyxJQUE1QixFQUFrQztBQUNoQyxNQUFJLENBQUMsWUFBWUMsSUFBWixDQUFpQkQsSUFBakIsQ0FBTCxFQUE2QjtBQUMzQixR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QTJCbUMsVUFBM0IsRUFBdUM7QUFDNUMsTUFBSUMsY0FBYyxFQUFsQjs7QUFFQUMsU0FBT0MsSUFBUCxDQUFZSCxXQUFXSSxNQUFYLElBQXFCLEVBQWpDLEVBQXFDN0IsT0FBckMsQ0FBNkMsaUJBQVM7QUFDcEQ7QUFDQSxRQUFJOEIsVUFBVSxVQUFkLEVBQTBCO0FBQ3hCLGdEQUFtQkEsS0FBbkIsRUFBMEJMLFdBQVdJLE1BQVgsQ0FBa0JDLEtBQWxCLENBQTFCLEVBQW9ELEVBQXBELEVBQXdEOUIsT0FBeEQsQ0FBZ0UsVUFBVStCLFlBQVYsRUFBd0I7QUFDdEY7QUFDQTtBQUNBTCxvQkFBWXJCLElBQVosQ0FBaUIwQixhQUFhbkIsR0FBYixHQUFtQixHQUFuQixHQUF5Qm1CLGFBQWFwQyxLQUF2RDtBQUNELE9BSkQ7QUFLRCxLQU5ELE1BTU87QUFDTCtCLGtCQUFZckIsSUFBWixDQUFpQnlCLFFBQVEsR0FBUixHQUFjekMscUJBQXFCb0MsV0FBV0ksTUFBWCxDQUFrQkMsS0FBbEIsQ0FBckIsQ0FBL0I7QUFDRDtBQUNGLEdBWEQ7O0FBYUEsU0FBT0wsV0FBVzlCLEtBQVgsSUFBb0IrQixZQUFZbEIsTUFBWixHQUFxQixPQUFPa0IsWUFBWWhCLElBQVosQ0FBaUIsSUFBakIsQ0FBNUIsR0FBcUQsRUFBekUsQ0FBUDtBQUNEIiwiZmlsZSI6InV0aWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWRpc2FibGUgbm9kZS9uby1kZXByZWNhdGVkLWFwaSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tY29udHJvbC1yZWdleCAqL1xuXG5pbXBvcnQgeyBmbGF0dGVuIH0gZnJvbSAncmFtZGEnXG5pbXBvcnQgcGFyc2VBZGRyZXNzIGZyb20gJ2VtYWlsanMtYWRkcmVzc3BhcnNlcidcbmltcG9ydCB7XG4gIG1pbWVXb3Jkc0VuY29kZSxcbiAgbWltZVdvcmRFbmNvZGUsXG4gIGNvbnRpbnVhdGlvbkVuY29kZVxufSBmcm9tICdlbWFpbGpzLW1pbWUtY29kZWMnXG5pbXBvcnQgeyB0b0FTQ0lJIH0gZnJvbSAncHVueWNvZGUnXG5cbi8qKlxuICogSWYgbmVlZGVkLCBtaW1lIGVuY29kZXMgdGhlIG5hbWUgcGFydFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgcGFydCBvZiBhbiBhZGRyZXNzXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBNaW1lIHdvcmQgZW5jb2RlZCBzdHJpbmcgaWYgbmVlZGVkXG4gKi9cbmZ1bmN0aW9uIGVuY29kZUFkZHJlc3NOYW1lIChuYW1lKSB7XG4gIGlmICghL15bXFx3ICddKiQvLnRlc3QobmFtZSkpIHtcbiAgICBpZiAoL15bXFx4MjAtXFx4N2VdKiQvLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiAnXCInICsgbmFtZS5yZXBsYWNlKC8oW1xcXFxcIl0pL2csICdcXFxcJDEnKSArICdcIidcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG1pbWVXb3JkRW5jb2RlKG5hbWUsICdRJylcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5hbWVcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYSB2YWx1ZSBpcyBwbGFpbnRleHQgc3RyaW5nICh1c2VzIG9ubHkgcHJpbnRhYmxlIDdiaXQgY2hhcnMpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFN0cmluZyB0byBiZSB0ZXN0ZWRcbiAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGl0IGlzIGEgcGxhaW50ZXh0IHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQbGFpblRleHQgKHZhbHVlKSB7XG4gIHJldHVybiAhKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgfHwgL1tcXHgwMC1cXHgwOFxceDBiXFx4MGNcXHgwZS1cXHgxZlxcdTAwODAtXFx1RkZGRl0vLnRlc3QodmFsdWUpKVxufVxuXG4vKipcbiAqIFJlYnVpbGRzIGFkZHJlc3Mgb2JqZWN0IHVzaW5nIHB1bnljb2RlIGFuZCBvdGhlciBhZGp1c3RtZW50c1xuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGFkZHJlc3NlcyBBbiBhcnJheSBvZiBhZGRyZXNzIG9iamVjdHNcbiAqIEBwYXJhbSB7QXJyYXl9IFt1bmlxdWVMaXN0XSBBbiBhcnJheSB0byBiZSBwb3B1bGF0ZWQgd2l0aCBhZGRyZXNzZXNcbiAqIEByZXR1cm4ge1N0cmluZ30gYWRkcmVzcyBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRBZGRyZXNzZXMgKGFkZHJlc3NlcyA9IFtdLCB1bmlxdWVMaXN0ID0gW10pIHtcbiAgdmFyIHZhbHVlcyA9IFtdXG5cbiAgO1tdLmNvbmNhdChhZGRyZXNzZXMpLmZvckVhY2goYWRkcmVzcyA9PiB7XG4gICAgaWYgKGFkZHJlc3MuYWRkcmVzcykge1xuICAgICAgYWRkcmVzcy5hZGRyZXNzID0gYWRkcmVzcy5hZGRyZXNzXG4gICAgICAgIC5yZXBsYWNlKC9eLio/KD89QCkvLCB1c2VyID0+IG1pbWVXb3Jkc0VuY29kZSh1c2VyLCAnUScpKVxuICAgICAgICAucmVwbGFjZSgvQC4rJC8sIGRvbWFpbiA9PiAnQCcgKyB0b0FTQ0lJKGRvbWFpbi5zdWJzdHIoMSkpKVxuXG4gICAgICBpZiAoIWFkZHJlc3MubmFtZSkge1xuICAgICAgICB2YWx1ZXMucHVzaChhZGRyZXNzLmFkZHJlc3MpXG4gICAgICB9IGVsc2UgaWYgKGFkZHJlc3MubmFtZSkge1xuICAgICAgICB2YWx1ZXMucHVzaChlbmNvZGVBZGRyZXNzTmFtZShhZGRyZXNzLm5hbWUpICsgJyA8JyArIGFkZHJlc3MuYWRkcmVzcyArICc+JylcbiAgICAgIH1cblxuICAgICAgaWYgKHVuaXF1ZUxpc3QuaW5kZXhPZihhZGRyZXNzLmFkZHJlc3MpIDwgMCkge1xuICAgICAgICB1bmlxdWVMaXN0LnB1c2goYWRkcmVzcy5hZGRyZXNzKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYWRkcmVzcy5ncm91cCkge1xuICAgICAgdmFsdWVzLnB1c2goZW5jb2RlQWRkcmVzc05hbWUoYWRkcmVzcy5uYW1lKSArICc6JyArIChhZGRyZXNzLmdyb3VwLmxlbmd0aCA/IGNvbnZlcnRBZGRyZXNzZXMoYWRkcmVzcy5ncm91cCwgdW5pcXVlTGlzdCkgOiAnJykudHJpbSgpICsgJzsnKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gdmFsdWVzLmpvaW4oJywgJylcbn1cblxuLyoqXG4gKiBQYXJzZXMgYWRkcmVzc2VzLiBUYWtlcyBpbiBhIHNpbmdsZSBhZGRyZXNzIG9yIGFuIGFycmF5IG9yIGFuXG4gKiBhcnJheSBvZiBhZGRyZXNzIGFycmF5cyAoZWcuIFRvOiBbW2ZpcnN0IGdyb3VwXSwgW3NlY29uZCBncm91cF0sLi4uXSlcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBhZGRyZXNzZXMgQWRkcmVzc2VzIHRvIGJlIHBhcnNlZFxuICogQHJldHVybiB7QXJyYXl9IEFuIGFycmF5IG9mIGFkZHJlc3Mgb2JqZWN0c1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VBZGRyZXNzZXMgKGFkZHJlc3NlcyA9IFtdKSB7XG4gIHJldHVybiBmbGF0dGVuKFtdLmNvbmNhdChhZGRyZXNzZXMpLm1hcCgoYWRkcmVzcykgPT4ge1xuICAgIGlmIChhZGRyZXNzICYmIGFkZHJlc3MuYWRkcmVzcykge1xuICAgICAgYWRkcmVzcyA9IGNvbnZlcnRBZGRyZXNzZXMoYWRkcmVzcylcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlQWRkcmVzcyhhZGRyZXNzKVxuICB9KSlcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgaGVhZGVyIHZhbHVlIGZvciB1c2UgaW4gdGhlIGdlbmVyYXRlZCByZmMyODIyIGVtYWlsLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgSGVhZGVyIGtleVxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jb2RlSGVhZGVyVmFsdWUgKGtleSwgdmFsdWUgPSAnJykge1xuICBrZXkgPSBub3JtYWxpemVIZWFkZXJLZXkoa2V5KVxuXG4gIHN3aXRjaCAoa2V5KSB7XG4gICAgY2FzZSAnRnJvbSc6XG4gICAgY2FzZSAnU2VuZGVyJzpcbiAgICBjYXNlICdUbyc6XG4gICAgY2FzZSAnQ2MnOlxuICAgIGNhc2UgJ0JjYyc6XG4gICAgY2FzZSAnUmVwbHktVG8nOlxuICAgICAgcmV0dXJuIGNvbnZlcnRBZGRyZXNzZXMocGFyc2VBZGRyZXNzZXModmFsdWUpKVxuXG4gICAgY2FzZSAnTWVzc2FnZS1JZCc6XG4gICAgY2FzZSAnSW4tUmVwbHktVG8nOlxuICAgIGNhc2UgJ0NvbnRlbnQtSWQnOlxuICAgICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnICcpXG5cbiAgICAgIGlmICh2YWx1ZS5jaGFyQXQoMCkgIT09ICc8Jykge1xuICAgICAgICB2YWx1ZSA9ICc8JyArIHZhbHVlXG4gICAgICB9XG5cbiAgICAgIGlmICh2YWx1ZS5jaGFyQXQodmFsdWUubGVuZ3RoIC0gMSkgIT09ICc+Jykge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlICsgJz4nXG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWVcblxuICAgIGNhc2UgJ1JlZmVyZW5jZXMnOlxuICAgICAgdmFsdWUgPSBbXS5jb25jYXQuYXBwbHkoW10sIFtdLmNvbmNhdCh2YWx1ZSkubWFwKChlbG0gPSAnJykgPT4gZWxtXG4gICAgICAgIC5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnICcpXG4gICAgICAgIC50cmltKClcbiAgICAgICAgLnJlcGxhY2UoLzxbXj5dKj4vZywgc3RyID0+IHN0ci5yZXBsYWNlKC9cXHMvZywgJycpKVxuICAgICAgICAuc3BsaXQoL1xccysvKVxuICAgICAgKSkubWFwKGZ1bmN0aW9uIChlbG0pIHtcbiAgICAgICAgaWYgKGVsbS5jaGFyQXQoMCkgIT09ICc8Jykge1xuICAgICAgICAgIGVsbSA9ICc8JyArIGVsbVxuICAgICAgICB9XG4gICAgICAgIGlmIChlbG0uY2hhckF0KGVsbS5sZW5ndGggLSAxKSAhPT0gJz4nKSB7XG4gICAgICAgICAgZWxtID0gZWxtICsgJz4nXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVsbVxuICAgICAgfSlcblxuICAgICAgcmV0dXJuIHZhbHVlLmpvaW4oJyAnKS50cmltKClcblxuICAgIGNhc2UgJ1N1YmplY3QnOlxuICAgICAgcmV0dXJuIG1pbWVXb3JkRW5jb2RlKCh2YWx1ZSB8fCAnJykudG9TdHJpbmcoKS5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnICcpLCAnQicpXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBtaW1lV29yZHNFbmNvZGUoKHZhbHVlIHx8ICcnKS50b1N0cmluZygpLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJyksICdCJylcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZXMgYSBoZWFkZXIga2V5LCB1c2VzIENhbWVsLUNhc2UgZm9ybSwgZXhjZXB0IGZvciB1cHBlcmNhc2UgTUlNRS1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSB0byBiZSBub3JtYWxpemVkXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGtleSBpbiBDYW1lbC1DYXNlIGZvcm1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlcktleSAoa2V5ID0gJycpIHtcbiAgcmV0dXJuIGtleS5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnICcpIC8vIG5vIG5ld2xpbmVzIGluIGtleXNcbiAgICAudHJpbSgpLnRvTG93ZXJDYXNlKClcbiAgICAucmVwbGFjZSgvXk1JTUVcXGJ8XlthLXpdfC1bYS16XS9pZywgYyA9PiBjLnRvVXBwZXJDYXNlKCkpIC8vIHVzZSB1cHBlcmNhc2Ugd29yZHMsIGV4Y2VwdCBNSU1FXG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgbXVsdGlwYXJ0IGJvdW5kYXJ5IHZhbHVlXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSBib3VuZGFyeSB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVCb3VuZGFyeSAobm9kZUlkLCBiYXNlQm91bmRhcnkpIHtcbiAgcmV0dXJuICctLS0tc2luaWthZWwtPz1fJyArIG5vZGVJZCArICctJyArIGJhc2VCb3VuZGFyeVxufVxuXG4vKipcbiAqIEVzY2FwZXMgYSBoZWFkZXIgYXJndW1lbnQgdmFsdWUgKGVnLiBib3VuZGFyeSB2YWx1ZSBmb3IgY29udGVudCB0eXBlKSxcbiAqIGFkZHMgc3Vycm91bmRpbmcgcXVvdGVzIGlmIG5lZWRlZFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBIZWFkZXIgYXJndW1lbnQgdmFsdWVcbiAqIEByZXR1cm4ge1N0cmluZ30gZXNjYXBlZCBhbmQgcXVvdGVkIChpZiBuZWVkZWQpIGFyZ3VtZW50IHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVIZWFkZXJBcmd1bWVudCAodmFsdWUpIHtcbiAgaWYgKHZhbHVlLm1hdGNoKC9bXFxzJ1wiXFxcXDsvPV18Xi0vZykpIHtcbiAgICByZXR1cm4gJ1wiJyArIHZhbHVlLnJlcGxhY2UoLyhbXCJcXFxcXSkvZywgJ1xcXFwkMScpICsgJ1wiJ1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB2YWx1ZVxuICB9XG59XG5cbi8qKlxuICogSm9pbnMgcGFyc2VkIGhlYWRlciB2YWx1ZSB0b2dldGhlciBhcyAndmFsdWU7IHBhcmFtMT12YWx1ZTE7IHBhcmFtMj12YWx1ZTInXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHN0cnVjdHVyZWQgUGFyc2VkIGhlYWRlciB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBqb2luZWQgaGVhZGVyIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEhlYWRlclZhbHVlIChzdHJ1Y3R1cmVkKSB7XG4gIHZhciBwYXJhbXNBcnJheSA9IFtdXG5cbiAgT2JqZWN0LmtleXMoc3RydWN0dXJlZC5wYXJhbXMgfHwge30pLmZvckVhY2gocGFyYW0gPT4ge1xuICAgIC8vIGZpbGVuYW1lIG1pZ2h0IGluY2x1ZGUgdW5pY29kZSBjaGFyYWN0ZXJzIHNvIGl0IGlzIGEgc3BlY2lhbCBjYXNlXG4gICAgaWYgKHBhcmFtID09PSAnZmlsZW5hbWUnKSB7XG4gICAgICBjb250aW51YXRpb25FbmNvZGUocGFyYW0sIHN0cnVjdHVyZWQucGFyYW1zW3BhcmFtXSwgNTApLmZvckVhY2goZnVuY3Rpb24gKGVuY29kZWRQYXJhbSkge1xuICAgICAgICAvLyBjb250aW51YXRpb24gZW5jb2RlZCBzdHJpbmdzIGFyZSBhbHdheXMgZXNjYXBlZCwgc28gbm8gbmVlZCB0byB1c2UgZW5jbG9zaW5nIHF1b3Rlc1xuICAgICAgICAvLyBpbiBmYWN0IHVzaW5nIHF1b3RlcyBtaWdodCBlbmQgdXAgd2l0aCBpbnZhbGlkIGZpbGVuYW1lcyBpbiBzb21lIGNsaWVudHNcbiAgICAgICAgcGFyYW1zQXJyYXkucHVzaChlbmNvZGVkUGFyYW0ua2V5ICsgJz0nICsgZW5jb2RlZFBhcmFtLnZhbHVlKVxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1zQXJyYXkucHVzaChwYXJhbSArICc9JyArIGVzY2FwZUhlYWRlckFyZ3VtZW50KHN0cnVjdHVyZWQucGFyYW1zW3BhcmFtXSkpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBzdHJ1Y3R1cmVkLnZhbHVlICsgKHBhcmFtc0FycmF5Lmxlbmd0aCA/ICc7ICcgKyBwYXJhbXNBcnJheS5qb2luKCc7ICcpIDogJycpXG59XG4iXX0=