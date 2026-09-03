(function(){
  function runner(success, failure){
    return new Proxy({}, {
      get(_, prop){
        if(prop === 'withSuccessHandler') return fn => runner(fn, failure);
        if(prop === 'withFailureHandler') return fn => runner(success, fn);
        return (...args) => {
          fetch('/api/rpc', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({method:String(prop), args})
          }).then(async r=>{
            const data=await r.json().catch(()=>({}));
            if(!r.ok || data.ok===false) throw new Error(data.error || ('HTTP '+r.status));
            return data.result;
          }).then(x=>{ if(success) success(x); }).catch(err=>{
            console.error(err);
            if(failure) failure(err.message || String(err));
          });
        };
      }
    });
  }
  window.google = window.google || {};
  window.google.script = { run: runner(null,null) };
})();
