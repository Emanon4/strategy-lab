/* 长期沙盘的运行桥：
   原页面是为 Claude Artifact 写的，依赖 window.claude 提供 AI。
   放到 GitHub Pages 后，这里用主站「战略推演」的 AI 设置（同一个浏览器里的 localStorage）来提供同样的接口。
   数据存储走原页面自带的浏览器本地模式。 */
(function () {
  "use strict";
  function settings() {
    try { return JSON.parse(localStorage.getItem('zhanlue-ai') || '{}'); } catch (e) { return {}; }
  }
  function ready(s) { return !!s.key && (s.provider !== 'openai' || (!!s.base && !!s.oaModel)); }
  function parseJSON(t) {
    if (!t) return undefined;
    try { return JSON.parse(t); } catch (e) {}
    var m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) { try { return JSON.parse(m[1]); } catch (e) {} }
    var a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    return undefined;
  }
  async function call(prompt, signal) {
    var s = settings(), res, data;
    var text = typeof prompt === 'string' ? prompt : prompt.map(function (m) { return m.content; }).join('\n\n');
    try {
      if (s.provider === 'openai') {
        res = await fetch(s.base.replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST', signal: signal,
          headers: {'content-type': 'application/json', 'authorization': 'Bearer ' + s.key},
          body: JSON.stringify({model: s.oaModel, temperature: 0.7, max_tokens: 4096, messages: [{role: 'user', content: text}]})
        });
      } else {
        res = await fetch((s.base || 'https://api.anthropic.com').replace(/\/+$/, '') + '/v1/messages', {
          method: 'POST', signal: signal,
          headers: {'content-type': 'application/json', 'x-api-key': s.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'},
          body: JSON.stringify({model: s.model || 'claude-sonnet-5-5', max_tokens: 4096, messages: [{role: 'user', content: text}]})
        });
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw {code: 'cancelled', message: 'aborted'};
      throw {code: 'upstream_error', message: String(e)};
    }
    if (!res.ok) {
      throw {code: res.status === 429 ? 'rate_limited' : 'upstream_error', message: 'HTTP ' + res.status};
    }
    data = await res.json();
    if (s.provider === 'openai') return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    return (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  }
  function sample(input, opts) {
    opts = opts || {};
    return call(input, opts.signal).then(function (text) {
      if (!text) throw {code: 'empty_completion', message: 'empty'};
      if (opts.onText) { try { opts.onText({text: text, delta: text}); } catch (e) {} }
      return {text: text, truncated: false, modelTierApplied: 'default'};
    });
  }
  sample.json = function (input, opts) {
    opts = opts || {};
    return call(input, opts.signal).then(function (text) {
      var v = parseJSON(text);
      if (v === undefined) throw {code: 'invalid_json', message: 'no JSON', text: text};
      return v;
    });
  };
  window.claude = {
    use: function (name) {
      if (name === 'sample') return Promise.resolve(ready(settings()) ? sample : null);
      return Promise.resolve(null);
    }
  };
})();
