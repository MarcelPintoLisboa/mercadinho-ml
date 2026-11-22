import { useState, type FormEvent } from 'react';
import { mensagemErro, supabase } from '../nuvem';

// Tela de entrada (aparece quando não há usuário logado)
export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Informe um e-mail válido.');
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { app: 'Mercadinho ML' } }, // aparece em usuarios.app_cadastro
        });
        if (error) throw error;
        if (!data.session) {
          setInfo(`Enviamos um link de confirmação para ${email.trim()}. Depois de confirmar, volte aqui e entre.`);
          setModo('entrar');
        }
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <form className="login-cartao" onSubmit={enviar} noValidate>
        <img src="./icon-192.png" alt="" className="login-logo" />
        <h1>Mercadinho ML</h1>
        <p className="login-sub">Estoque, vendas e indicadores salvos na nuvem.</p>

        <h2>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h2>
        <label className="campo">
          <span>E-mail</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
        </label>
        <label className="campo">
          <span>Senha</span>
          <div className="login-senha">
            <input
              type={verSenha ? 'text' : 'password'}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
            <button type="button" className="btn btn-pequeno" onClick={() => setVerSenha((v) => !v)}>
              {verSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        {erro && <p className="login-erro" role="alert">{erro}</p>}
        {info && <p className="login-info" role="status">{info}</p>}

        <button type="submit" className="btn btn-primario btn-gigante" disabled={enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
        <button
          type="button"
          className="login-trocar"
          onClick={() => {
            setModo(modo === 'entrar' ? 'criar' : 'entrar');
            setErro('');
          }}
        >
          {modo === 'entrar' ? <>Não tem conta? <strong>Criar conta</strong></> : <>Já tem conta? <strong>Entrar</strong></>}
        </button>
        <small className="login-rodape">ML Softwares</small>
      </form>
    </div>
  );
}
