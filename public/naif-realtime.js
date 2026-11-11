/* Naif: live two-way Arabic voice, using Rashid's WebRTC interaction model.
   This module never reads any dashboard source except through NaifVoiceBridge. */
(() => { 'use strict';
const MAX_CALL_MS = 15 * 60 * 1000;
let version=0, pc=null, channel=null, microphone=null, speaker=null, idleTimer=null, dropTimer=null, connectTimer=null;
let active=false, connecting=false, muted=false, playback=true, spoken='', lastError='';
const processedCalls=new Set(), transcriptItems=new Set();
const byId=id=>document.getElementById(id);
function bridge(){return window.NaifVoiceBridge;}
function report(s,message){bridge()?.state?.(s,message);}
function bubble(text,user=false){bridge()?.bubble?.(String(text||''),user);}
function ready(){return !!(bridge() && document.querySelector('.vd-naif-call'));}
function render(){
 const dialog=document.querySelector('.vd-naif[role="dialog"]'),call=dialog?.querySelector('.vd-naif-call'),mic=dialog?.querySelector('.vd-naif-mic');
 if(call){
  call.disabled=connecting;
  call.textContent=connecting?'⌛ جارٍ الاتصال بالعربية...':active?'⏹ إنهاء مكالمة نايف':'📞 محادثة نايف الصوتية';
  call.setAttribute('aria-pressed',String(active||connecting));
  call.classList.toggle('is-active',active||connecting);
 }
 if(mic&&(active||connecting)){
  mic.textContent=muted?'🎙️':'🔇';
  mic.title=muted?'تشغيل الميكروفون':'كتم الميكروفون';
  mic.setAttribute('aria-pressed',String(muted));
 }
 if(dialog)dialog.classList.toggle('vd-naif-realtime',active||connecting);
}
function send(data){
 if(channel?.readyState!=='open')return false;
 try{channel.send(JSON.stringify(data));return true;}catch{return false;}
}
function stop(message='انتهت مكالمة نايف.'){
 version++;active=false;connecting=false;muted=false;spoken='';lastError='';processedCalls.clear();transcriptItems.clear();
 if(idleTimer)clearTimeout(idleTimer);idleTimer=null;
 if(dropTimer)clearTimeout(dropTimer);dropTimer=null;
 if(connectTimer)clearTimeout(connectTimer);connectTimer=null;
 try{channel?.close();}catch{}
 try{pc?.close();}catch{}
 try{microphone?.getTracks?.().forEach(track=>track.stop());}catch{}
 if(speaker){try{speaker.pause();speaker.srcObject=null;speaker.remove();}catch{}}
 pc=null;channel=null;microphone=null;speaker=null;
 render();if(ready())report('idle',message);
}
async function consult(item,token){
 if(!item?.call_id||processedCalls.has(item.call_id))return;
 processedCalls.add(item.call_id);
 let answer='';
 try{
  const args=JSON.parse(item.arguments||'{}');
  const question=String(args.question||'').trim().slice(0,1500);
  if(!question)throw Error('لم يصل السؤال بوضوح');
  if(version!==token||!active)return;
  report('thinking','نايف يراجع مؤشرات وشيتات المشروع المصرّح بها...');
  answer=await bridge()?.answer?.(question);
  if(!answer)answer='لم أتمكن من الحصول على إجابة موثوقة لهذا السؤال. أعد صياغته.';
 }catch(error){answer='تعذّر البحث في بيانات مشروعك الآن: '+String(error?.message||error).slice(0,180);}
 if(version!==token||!active)return;
 const output={answer:String(answer).slice(0,10000)};
 if(send({type:'conversation.item.create',item:{type:'function_call_output',call_id:item.call_id,output:JSON.stringify(output)}})){
  send({type:'response.create',response:{output_modalities:['audio']}});
 }
}
function receive(raw,token){
 if(token!==version||!active)return;
 let e;try{e=JSON.parse(raw)}catch{return;}
 switch(e.type){
  case 'input_audio_buffer.speech_started':
   spoken='';report('listening','نايف يستمع إليك بالعربية ويمكنك مقاطعته.');break;
  case 'input_audio_buffer.speech_stopped':
   report('thinking','نايف يحوّل السؤال العربي إلى نص...');break;
  case 'conversation.item.input_audio_transcription.completed': {
   const transcript=String(e.transcript||'').trim();
   const item=String(e.item_id||transcript);
   if(transcript&&!transcriptItems.has(item)){
    transcriptItems.add(item);
    bridge()?.transcript?.(transcript);
    bubble(transcript,true);
   }
   report('thinking',transcript?'سمع نايف: '+transcript.slice(0,125):'نايف يبحث عن الإجابة...');
   break;
  }
  case 'conversation.item.input_audio_transcription.failed':
   report('listening','تعذّر تفريغ هذا السؤال؛ انطقه مجددًا بوضوح.');break;
  case 'response.output_audio.delta':
  case 'response.audio.delta':
   report('speaking','نايف يجيب صوتيًا بالعربية...');break;
  case 'response.output_audio_transcript.delta':
  case 'response.audio_transcript.delta':
  case 'response.output_text.delta':
   spoken+=String(e.delta||'');
   if(spoken)report('speaking','نايف: '+spoken.slice(-125));
   break;
  case 'response.output_audio_transcript.done':
  case 'response.audio_transcript.done':
   if(!spoken&&e.transcript)spoken=String(e.transcript);
   break;
  case 'response.done':{
   const calls=(e.response?.output||[]).filter(x=>x.type==='function_call'&&x.name==='consult_naif_dashboard');
   if(calls.length){spoken='';calls.forEach(call=>{void consult(call,token)});}
   else{
    if(spoken.trim())bubble(spoken.trim(),false);
    spoken='';
    if(e.response?.status==='failed')report('idle','تعذّر الرد الصوتي؛ أعد السؤال من فضلك.');
    else report('listening','نايف يسمعك الآن. تحدث بالعربية متى شئت.');
   }
   break;
  }
  case 'error':
   lastError=String(e.error?.code||e.error?.type||'VOICE_ERROR').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,75);
   console.warn('NAIF_REALTIME_ERROR',lastError);
   report('idle','تعذّر تنفيذ جزء من المكالمة (رمز '+lastError+').');
   break;
 }
}
function waitIce(peer){
 if(peer.iceGatheringState==='complete')return Promise.resolve();
 return new Promise(resolve=>{
  const check=()=>{if(peer.iceGatheringState==='complete')done();};
  const done=()=>{clearTimeout(t);peer.removeEventListener('icegatheringstatechange',check);resolve();};
  const t=setTimeout(done,5000);
  peer.addEventListener('icegatheringstatechange',check);
 });
}
async function available(){
 try{
  const res=await fetch('/api/naif/realtime/status',{credentials:'same-origin',cache:'no-store'});
  if(res.status===401){bubble('انتهت جلسة الدخول، سجّل الدخول مجددًا لتفعيل الصوت.',false);return {ok:false,handled:true};}
  const data=await res.json().catch(()=>({}));
  return {ok:!!res.ok&&data.enabled===true,handled:!res.ok};
 }catch(error){return {ok:false,handled:false};}
}
async function start(){
 if(active||connecting)return true;
 if(!ready())return false;
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)return false;
 const status=await available();
 if(!status.ok)return !!status.handled;
 const token=++version;connecting=true;muted=false;spoken='';lastError='';render();
 report('listening','جارٍ تجهيز مكالمة نايف الطبيعية باللغة العربية...');
 try{
  // Avoid echo from the legacy browser-voice fallback.
  window.speechSynthesis?.cancel?.();
  bridge()?.stopClassic?.();render();
  microphone=await navigator.mediaDevices.getUserMedia({
   audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
  });
  if(token!==version){microphone.getTracks().forEach(t=>t.stop());return true;}
  pc=new RTCPeerConnection();
  speaker=document.createElement('audio');speaker.autoplay=true;speaker.playsInline=true;speaker.setAttribute('playsinline','');speaker.hidden=true;speaker.muted=!playback;document.body.append(speaker);
  pc.ontrack=e=>{
   if(token!==version)return;
   speaker.srcObject=e.streams?.[0]||new MediaStream([e.track]);
   speaker.play().catch(()=>report('speaking','السماعة لم تبدأ تلقائيًا؛ اسمح بتشغيل الصوت في المتصفح.'));
  };
  pc.onconnectionstatechange=()=>{
   if(token!==version||!pc)return;
   const state=pc.connectionState;
   if(state==='connected'){if(dropTimer)clearTimeout(dropTimer);dropTimer=null;}
   else if(state==='disconnected'||state==='failed'){
    report('idle','الاتصال غير مستقر، أحاول استعادة الصوت...');
    if(dropTimer)clearTimeout(dropTimer);
    dropTimer=setTimeout(()=>{if(token===version&&pc?.connectionState!=='connected')stop('انقطع الاتصال الصوتي؛ أعد المكالمة أو غيّر الشبكة.');},state==='failed'?2000:7000);
   }else if(state==='closed'&&(active||connecting))stop('انتهى اتصال نايف الصوتي.');
  };
  microphone.getAudioTracks().forEach(t=>t.onended=()=>{if(token===version&&(active||connecting))stop('توقف الميكروفون؛ تحقق من الصلاحية.')});
  microphone.getTracks().forEach(track=>pc.addTrack(track,microphone));
  channel=pc.createDataChannel('oai-events');
  channel.onopen=()=>{
   if(token!==version)return;
   active=true;connecting=false;render();
   if(connectTimer)clearTimeout(connectTimer);connectTimer=null;
   report('listening','نايف متصل ويستمع بالعربية.');
   send({type:'response.create',response:{output_modalities:['audio']}});
   idleTimer=setTimeout(()=>stop('انتهت المكالمة بعد 15 دقيقة حفاظًا على الموارد.'),MAX_CALL_MS);
  };
  channel.onmessage=e=>receive(e.data,token);
  channel.onerror=()=>report('idle','حدثت مشكلة في قناة الصوت؛ تحقق من الاتصال.');
  channel.onclose=()=>{if(token===version&&(active||connecting))stop('أُغلقت القناة الصوتية'+(lastError?' ('+lastError+')':'')+'.')};
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);await waitIce(pc);
  if(token!==version)return true;
  const response=await fetch('/api/naif/realtime/call',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:pc.localDescription.sdp})});
  if(!response.ok){const err=await response.json().catch(()=>({}));throw Error(err.error||'فشل اتصال خدمة الصوت ('+response.status+')');}
  const sdp=await response.text();
  if(token!==version)return true;
  if(!sdp.startsWith('v=0'))throw Error('استجابة WebRTC غير صالحة');
  await pc.setRemoteDescription({type:'answer',sdp});
  connectTimer=setTimeout(()=>{if(token===version&&connecting)stop('لم يكتمل الاتصال الصوتي؛ قد تحجب الشبكة WebRTC.');},18000);
  return true;
 }catch(error){
  if(token===version){const message='تعذّر بدء مكالمة نايف: '+String(error.message||error).slice(0,175);stop(message);bubble(message,false);}
  return /NotAllowedError|NotFoundError|Permission|device|الميكروفون/i.test(String(error.name||'')+' '+String(error.message||''));
 }
}
function toggleMute(){
 if(!active||!microphone)return;
 muted=!muted;
 microphone.getAudioTracks().forEach(track=>track.enabled=!muted);
 render();report(muted?'idle':'listening',muted?'الميكروفون مكتوم.':'نايف يستمع إليك الآن.');
}
function setPlayback(on){playback=!!on;if(speaker)speaker.muted=!playback;}
/* Rashid-style precise Arabic voice-to-text for the single microphone button.
   Users review the transcript before sending. No recording is kept in this client. */
let dictation=null;
function setDictationUI(recording){
 const mic=document.querySelector('.vd-naif-mic');
 if(!mic||active)return;
 mic.textContent=recording?'⏹':'🎤';
 mic.title=recording?'إنهاء الإملاء العربي':'إملاء السؤال بالعربية';
 mic.setAttribute('aria-pressed',String(recording));
}
function cancelDictation(){
 const item=dictation;dictation=null;
 if(!item)return;
 if(item.timer)clearTimeout(item.timer);
 try{if(item.recorder?.state==='recording')item.recorder.stop()}catch(e){}
 try{item.stream?.getTracks?.().forEach(t=>t.stop())}catch(e){}
 setDictationUI(false);
}
async function blobBase64(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
  reader.onerror=()=>reject(Error('تعذر قراءة التسجيل.'));
  reader.readAsDataURL(blob);
 });
}
async function dictate(){
 if(dictation){
  if(dictation.recorder?.state==='recording')dictation.recorder.stop();
  return true;
 }
 if(active||connecting)return true;
 if(!window.isSecureContext||!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia)return false;
 const enabled=await available();
 if(!enabled.ok)return !!enabled.handled;
 const session={stream:null,recorder:null,timer:null,chunks:[],cancelled:false};
 dictation=session;
 try{
  session.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  if(dictation!==session){session.stream.getTracks().forEach(t=>t.stop());return true}
  const formats=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mime=formats.find(type=>window.MediaRecorder.isTypeSupported?.(type))||'';
  session.recorder=mime?new window.MediaRecorder(session.stream,{mimeType:mime}):new window.MediaRecorder(session.stream);
  session.recorder.ondataavailable=e=>{if(e.data?.size)session.chunks.push(e.data)};
  session.recorder.onstop=async()=>{
   if(session.timer)clearTimeout(session.timer);
   session.stream?.getTracks?.().forEach(t=>t.stop());
   if(dictation!==session||session.cancelled)return;
   dictation=null;setDictationUI(false);
   report('thinking','نايف يدقق الكلمات والأرقام العربية...');
   try{
    const blob=new Blob(session.chunks,{type:session.recorder.mimeType||mime||'audio/webm'});
    if(blob.size<40)throw Error('التسجيل قصير للغاية.');
    if(blob.size>3300000)throw Error('التسجيل كبير؛ قلل مدة الإملاء.');
    const audio=await blobBase64(blob);
    const res=await fetch('/api/naif/transcribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio,mime:blob.type})});
    const result=await res.json().catch(()=>({}));
    if(!res.ok||!result.ok)throw Error(result.error||'تعذر التفريغ.');
    const text=String(result.text||'').replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).trim();
    bridge()?.setDictation?.(text);
    report('idle','تم كتابة السؤال بالعربية؛ راجع الأرقام واضغط Enter للإرسال.');
   }catch(err){report('idle','تعذر تدقيق التسجيل: '+String(err.message||err).slice(0,130));}
  };
  session.recorder.onerror=()=>{if(dictation===session){dictation=null;setDictationUI(false);report('idle','تعذر التقاط الصوت.')}};
  session.recorder.start();setDictationUI(true);
  report('listening','تحدث بالعربية ثم اضغط ⏹ لإنهاء الإملاء (حد أقصى 20 ثانية).');
  session.timer=setTimeout(()=>{if(session.recorder?.state==='recording')session.recorder.stop()},20000);
  return true;
 }catch(error){
  if(dictation===session){dictation=null;setDictationUI(false);}
  try{session.stream?.getTracks?.().forEach(t=>t.stop())}catch(e){}
  report('idle','تعذّر بدء الإملاء العربي: '+String(error.message||error).slice(0,125));
  return true;
 }
}

function init(){window.addEventListener('pagehide',()=>{cancelDictation();if(active||connecting)stop()});}
window.NaifRealtimeVoice={start,stop,toggleMute,setPlayback,dictate,cancelDictation,isActive:()=>active,isConnecting:()=>connecting,getStatus:()=>({active,connecting,muted,project:bridge()?.project||''})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();