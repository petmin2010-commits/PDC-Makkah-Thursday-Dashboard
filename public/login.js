

const form = document.getElementById('loginForm');
const email = document.getElementById('email');
const password = document.getElementById('password');
const button = document.getElementById('loginButton');
const message = document.getElementById('loginMessage');
const toggle = document.getElementById('togglePassword');


function showMessage(text,type='error'){
  message.textContent=text;
  message.className='login-message ' + type;
}


function clearMessage(){
  message.textContent='';
  message.className='login-message';
}


function loading(on){
  button.disabled=on;
  button.classList.toggle('loading',on);
}


toggle.addEventListener('click',()=>{
  const show=password.type==='password';

  password.type=show?'text':'password';

  toggle.textContent=show?'◉':'👁';

  toggle.setAttribute(
    'aria-label',
    show?'إخفاء كلمة المرور':'إظهار كلمة المرور'
  );
});


form.addEventListener('submit',async e=>{

  e.preventDefault();
  clearMessage();

  const emailValue=email.value.trim().toLowerCase();
  const passwordValue=password.value;

  if(!emailValue || !passwordValue){
    showMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    return;
  }

  loading(true);

  try{

    const response=await fetch('/api/auth/login',{
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      credentials:'same-origin',
      body:JSON.stringify({
        email:emailValue,
        password:passwordValue
      })
    });

    const data=await response.json().catch(()=>({}));

    if(response.ok && data.ok){

      showMessage(
        'تم تسجيل الدخول بنجاح، جاري فتح لوحة التحكم...',
        'success'
      );

      setTimeout(()=>{
        window.location.replace('/');
      },350);

      return;
    }


    if(response.status===429){

      showMessage(
        'تم إيقاف محاولات الدخول مؤقتًا بسبب تكرار المحاولات غير الصحيحة. حاول مرة أخرى بعد 15 دقيقة.'
      );

    }else if(data.error==='INVALID_INPUT'){

      showMessage(
        'يرجى التأكد من صيغة البريد الإلكتروني وكلمة المرور.'
      );

    }else{

      showMessage(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة، أو أن الحساب غير مفعل.'
      );

    }

  }catch(err){

    console.error(err);

    showMessage(
      'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.'
    );

  }finally{

    loading(false);

  }

});




