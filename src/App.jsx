import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy,
  query, serverTimestamp, setDoc, updateDoc
} from 'firebase/firestore';
import { db, firebaseReady } from './firebase.js';

const SYSTEM_EXCUSES = ['眠い', '時間がない', '疲れている', '気分が乗らない', '完璧にできそうにない'];
const STEP_SUGGESTIONS = {
  study: ['教材を開く', '1ページ読む', '1問だけ解く', 'ノートに1行書く'],
  thesis: ['卒論ファイルを開く', '昨日の文章を読む', '参考文献を1件確認する', '1文だけ書く'],
  exercise: ['運動着に着替える', '1分だけ身体を動かす', '靴を履く', 'ストレッチを1つする'],
  life: ['机の物を1つ戻す', '必要な物を1つ準備する', 'タイマーを1分に設定する', '対象の場所へ移動する'],
  other: ['必要な画面を開く', '道具を1つ準備する', '最初の1分だけ始める', '次の動作を1つ行う']
};
const CATEGORY_LABELS = { study: '勉強', thesis: '卒論・研究', exercise: '運動', life: '生活', other: 'その他' };
const STORAGE_CODE = 'mindameParticipantCodeV2';

const cleanCode = value => value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20);
const dateKey = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date);
const fmtDate = value => value ? new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(value.toDate ? value.toDate() : new Date(value)) : '';

function App() {
  const [screen, setScreen] = useState('loading');
  const [codeInput, setCodeInput] = useState('');
  const [participantCode, setParticipantCode] = useState(localStorage.getItem(STORAGE_CODE) || '');
  const [profile, setProfile] = useState(null);
  const [pending, setPending] = useState(null);
  const [history, setHistory] = useState([]);
  const [publicPosts, setPublicPosts] = useState([]);
  const [toast, setToast] = useState('');

  const participantRef = useMemo(() => participantCode && db ? doc(db, 'participantsV2', participantCode) : null, [participantCode]);

  const notify = msg => { setToast(msg); window.setTimeout(() => setToast(''), 2600); };

  useEffect(() => {
    if (!firebaseReady) { setScreen('config'); return; }
    if (!participantCode) { setScreen('entry'); return; }
    loadParticipant(participantCode);
  }, [participantCode]);

  async function loadParticipant(code) {
    setScreen('loading');
    try {
      const ref = doc(db, 'participantsV2', code);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setProfile(null); setScreen('onboarding'); return; }
      const data = snap.data();
      setProfile(data);
      const recordsQ = query(collection(ref, 'records'), orderBy('createdAt', 'desc'), limit(30));
      const recordsSnap = await getDocs(recordsQ);
      const records = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistory(records.filter(r => r.outcomeStatus));
      const openRecord = records.find(r => !r.outcomeStatus);
      setPending(openRecord || null);
      setScreen(openRecord ? 'review' : 'home');
    } catch (e) {
      console.error(e); notify('データを読み込めませんでした。'); setScreen('entry');
    }
  }

  async function enterCode() {
    const code = cleanCode(codeInput);
    if (code.length < 3) { notify('参加コードを3文字以上で入力してください。'); return; }
    localStorage.setItem(STORAGE_CODE, code);
    setParticipantCode(code);
  }

  function logout() {
    localStorage.removeItem(STORAGE_CODE);
    setParticipantCode(''); setProfile(null); setPending(null); setHistory([]); setScreen('entry');
  }

  async function finishOnboarding(form) {
    const ref = doc(db, 'participantsV2', participantCode);
    const data = {
      participantCode,
      appVersion: 2,
      consent: true,
      category: form.category,
      goalText: form.goalText.trim(),
      customExcuses: form.customExcuses,
      savedFirstSteps: STEP_SUGGESTIONS[form.category].slice(0, 3),
      onboardingCompleted: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, data);
    setProfile(data); setScreen('home'); notify('設定を保存しました。');
  }

  async function createPlan(plan) {
    const ref = doc(db, 'participantsV2', participantCode);
    const recordRef = doc(collection(ref, 'records'));
    const record = {
      participantCode,
      appVersion: 2,
      recordDate: dateKey(new Date()),
      predictedExcuse: plan.excuse,
      repeatedExcuse: plan.repeatedExcuse,
      firstStepText: plan.firstStep.trim(),
      shareExcuse: plan.shareExcuse,
      outcomeStatus: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(recordRef, record);
    if (plan.newExcuse && !profile.customExcuses?.includes(plan.excuse)) {
      const updated = [...(profile.customExcuses || []), plan.excuse].slice(-10);
      await updateDoc(ref, { customExcuses: updated, updatedAt: serverTimestamp() });
      setProfile(p => ({ ...p, customExcuses: updated }));
    }
    if (plan.firstStep && !profile.savedFirstSteps?.includes(plan.firstStep)) {
      const updated = [plan.firstStep, ...(profile.savedFirstSteps || [])].slice(0, 8);
      await updateDoc(ref, { savedFirstSteps: updated, updatedAt: serverTimestamp() });
      setProfile(p => ({ ...p, savedFirstSteps: updated }));
    }
    if (plan.shareExcuse) {
      await addDoc(collection(db, 'publicPostsV2'), {
        category: profile.category,
        excuseText: plan.excuse,
        isVisible: true,
        reactions: { relate: 0, novel: 0 },
        createdAt: serverTimestamp()
      });
    }
    setPending({ id: recordRef.id, ...record, createdAt: new Date() });
    setScreen('planDone');
  }

  async function submitReview(result) {
    const recordRef = doc(db, 'participantsV2', participantCode, 'records', pending.id);
    await updateDoc(recordRef, { ...result, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (result.actualExcuse && result.actualExcuse !== pending.predictedExcuse && !profile.customExcuses?.includes(result.actualExcuse)) {
      const ref = doc(db, 'participantsV2', participantCode);
      const updated = [...(profile.customExcuses || []), result.actualExcuse].slice(-10);
      await updateDoc(ref, { customExcuses: updated, updatedAt: serverTimestamp() });
      setProfile(p => ({ ...p, customExcuses: updated }));
    }
    const finalized = { ...pending, ...result, reviewedAt: new Date() };
    setHistory(h => [finalized, ...h]);
    setPending(null);
    setScreen('reflection');
  }

  async function loadPublicPosts() {
    setScreen('community');
    try {
      const qy = query(collection(db, 'publicPostsV2'), orderBy('createdAt', 'desc'), limit(30));
      const snap = await getDocs(qy);
      setPublicPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e); notify('共有投稿を読み込めませんでした。');
    }
  }

  async function react(post, key) {
    const next = { ...(post.reactions || {}), [key]: (post.reactions?.[key] || 0) + 1 };
    await updateDoc(doc(db, 'publicPostsV2', post.id), { reactions: next });
    setPublicPosts(ps => ps.map(p => p.id === post.id ? { ...p, reactions: next } : p));
  }

  const pace = useMemo(() => {
    const valid = history.filter(r => ['acted', 'rested', 'not_done'].includes(r.outcomeStatus)).slice(0, 7);
    const acted = valid.filter(r => r.outcomeStatus === 'acted').length;
    const rested = valid.filter(r => r.outcomeStatus === 'rested').length;
    const notDone = valid.filter(r => r.outcomeStatus === 'not_done').length;
    const percent = valid.length ? Math.round(acted / valid.length * 100) : null;
    return { valid: valid.length, acted, rested, notDone, percent };
  }, [history]);

  if (screen === 'loading') return <Shell><Loading /></Shell>;
  if (screen === 'config') return <Shell><ConfigError /></Shell>;
  if (screen === 'entry') return <Shell><Entry value={codeInput} setValue={setCodeInput} onEnter={enterCode} /></Shell>;
  if (screen === 'onboarding') return <Shell><Onboarding onSubmit={finishOnboarding} /></Shell>;
  if (screen === 'review') return <Shell profile={profile} logout={logout}><Review record={pending} profile={profile} onSubmit={submitReview} /></Shell>;
  if (screen === 'plan') return <Shell profile={profile} logout={logout}><Plan profile={profile} history={history} onSubmit={createPlan} onCancel={() => setScreen('home')} /></Shell>;
  if (screen === 'planDone') return <Shell profile={profile} logout={logout}><PlanDone plan={pending} onHome={() => setScreen('home')} onCommunity={loadPublicPosts} /></Shell>;
  if (screen === 'reflection') return <Shell profile={profile} logout={logout}><Reflection record={history[0]} onNext={() => setScreen('plan')} onHome={() => setScreen('home')} /></Shell>;
  if (screen === 'community') return <Shell profile={profile} logout={logout}><Community posts={publicPosts} category={profile.category} onReact={react} onBack={() => setScreen('home')} /></Shell>;
  return <Shell profile={profile} logout={logout} toast={toast}><Home profile={profile} pending={pending} pace={pace} history={history} onPlan={() => setScreen('plan')} onCommunity={loadPublicPosts} /></Shell>;
}

function Shell({ children, profile, logout, toast }) {
  return <div className="app-shell">
    <header className="topbar"><div className="brand">みんだめ<span>β</span></div>{profile && <button className="text-btn" onClick={logout}>参加コードを変更</button>}</header>
    <main>{children}</main>{toast && <div className="toast">{toast}</div>}
  </div>;
}

function Loading() { return <section className="center"><div className="loader" /><p>読み込んでいます</p></section>; }
function ConfigError() { return <section className="card hero"><h1>Firebase設定が必要です</h1><p>GitHubのRepository secretsに6つのFirebase設定を登録してから、Actionsを再実行してください。</p></section>; }
function Entry({ value, setValue, onEnter }) { return <section className="hero entry"><p className="eyebrow">行動と休息の、ちょうどいいところへ。</p><h1>みんだめ</h1><p>「どうせできない」を、<br />「意外とできた」に変える。</p><label>参加コード<input value={value} onChange={e => setValue(e.target.value)} placeholder="例：MD-001" /></label><button className="primary" onClick={onEnter}>はじめる</button><small>本名・学籍番号は入力しないでください。</small></section>; }

function Onboarding({ onSubmit }) {
  const [category, setCategory] = useState('thesis'); const [goalText, setGoalText] = useState('');
  const [selected, setSelected] = useState(['眠い', '時間がない']); const [custom, setCustom] = useState(''); const [consent, setConsent] = useState(false);
  const toggle = x => setSelected(s => s.includes(x) ? s.filter(v => v !== x) : [...s, x].slice(0, 5));
  const submit = () => { const all = custom.trim() ? [...selected, custom.trim()] : selected; if (!consent || !goalText.trim() || all.length < 2) return; onSubmit({ category, goalText, customExcuses: all }); };
  return <section className="stack"><div><p className="eyebrow">最初の設定</p><h1>ゆるく続けたいことを教えてください</h1></div>
    <div className="card"><h2>研究参加について</h2><p>アプリ内の操作と日々の記録を、参加コードで管理された研究データとして利用します。自由記述に個人情報を書かないでください。</p><label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />説明を読み、研究参加に同意します</label></div>
    <div className="card"><h2>取り組むジャンル</h2><div className="chips">{Object.entries(CATEGORY_LABELS).map(([k,v]) => <button key={k} className={category===k?'chip active':'chip'} onClick={() => setCategory(k)}>{v}</button>)}</div><label>続けたい目標<input value={goalText} onChange={e=>setGoalText(e.target.value)} placeholder="例：卒業論文を進める" maxLength={60}/></label></div>
    <div className="card"><h2>よく使いそうな言い訳</h2><p className="muted">2～5個選んでください。あとから自由に追加できます。</p><div className="chips">{SYSTEM_EXCUSES.map(x=><button key={x} className={selected.includes(x)?'chip ticket active':'chip ticket'} onClick={()=>toggle(x)}>{x}</button>)}</div><label>自分の言い訳を追加<input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="例：もう少し準備してから" maxLength={70}/></label></div>
    <button className="primary" disabled={!consent || !goalText.trim() || selected.length < 2} onClick={submit}>設定を保存する</button></section>;
}

function Home({ profile, pace, history, onPlan, onCommunity }) {
  const last = history[0];
  return <section className="stack"><div className="welcome"><p className="eyebrow">今日のことから、また考えられます。</p><h1>{profile.goalText}</h1></div>
    <button className="primary big" onClick={onPlan}>今日の作戦を考える</button>
    <Pace pace={pace} />
    {last && <div className="card"><h2>最近わかったこと</h2><p><strong>予測：</strong>{last.predictedExcuse}</p><p><strong>最初の一歩：</strong>{last.firstStepText}</p><ResultLine r={last}/></div>}
    <button className="secondary" onClick={onCommunity}>みんなの言い訳を見る</button>
    <p className="quiet">連続日数や欠けた日数は表示しません。できなかった日があっても、次に開いた日から再開できます。</p></section>;
}

function Pace({ pace }) {
  if (pace.valid < 4) return <div className="card"><h2>最近のペース</h2><p>記録をためている途中です。</p><p className="muted">数回の振り返りが集まると、行動と休息の配分が見えるようになります。</p></div>;
  const label = pace.percent < 50 ? '休息・未実行多め' : pace.percent <= 70 ? 'みんだめ上の「ちょうどいい」' : '行動多め';
  return <div className="card pace-card"><div className="pace-head"><div><h2>最近のペース</h2><p>{label}</p></div><strong>{pace.percent}%</strong></div><div className="meter"><div className="zone low"/><div className="zone middle"/><div className="zone high"/><i style={{left:`calc(${pace.percent}% - 7px)`}} /></div><div className="meter-labels"><span>休息・未実行多め</span><span>ちょうどいい</span><span>行動多め</span></div><div className="breakdown"><span>行動 <b>{pace.acted}</b></span><span>休息 <b>{pace.rested}</b></span><span>未実行 <b>{pace.notDone}</b></span></div><small>直近{pace.valid}回の有効な振り返りから計算しています。50～70％は科学的な最適値ではなく、100％だけを理想にしないための設計上の目安です。</small></div>;
}

function Plan({ profile, history, onSubmit, onCancel }) {
  const previous = history[0]?.predictedExcuse || '';
  const candidates = [...new Set([...(profile.customExcuses || []), ...SYSTEM_EXCUSES])].slice(0, 8);
  const [excuse, setExcuse] = useState(''); const [customExcuse, setCustomExcuse] = useState(''); const [repeatConfirmed, setRepeatConfirmed] = useState(false);
  const [firstStep, setFirstStep] = useState(''); const [customStep, setCustomStep] = useState(''); const [share, setShare] = useState(false);
  const repeated = excuse && excuse === previous;
  const actualExcuse = customExcuse.trim() || excuse; const actualStep = customStep.trim() || firstStep;
  const submit = () => onSubmit({ excuse: actualExcuse, firstStep: actualStep, repeatedExcuse: repeated, newExcuse: !!customExcuse.trim(), shareExcuse: share });
  return <section className="stack"><div><p className="eyebrow">今日の作戦</p><h1>まず、止まりそうな理由を予測します</h1></div>
    <div className="card"><h2>今日、使いそうな言い訳は？</h2><p className="muted">自分を責める言葉ではなく、今日の行動を止めそうな理由として選びます。</p><div className="chips">{candidates.map(x=><button key={x} className={excuse===x?'chip ticket active':'chip ticket'} onClick={()=>{setExcuse(x);setCustomExcuse('');setRepeatConfirmed(false)}}>{x}{x===previous && <small>昨日も使用</small>}</button>)}</div><label>ほかの言い訳を書く<input value={customExcuse} onChange={e=>{setCustomExcuse(e.target.value);setExcuse('')}} placeholder="個人が特定できる情報は書かないでください" maxLength={70}/></label>
    {repeated && !repeatConfirmed && <div className="repeat-box"><strong>前回も「{excuse}」でした。</strong><p>今回も同じ理由として記録しますか？</p><div className="row"><button className="secondary" onClick={()=>setRepeatConfirmed(true)}>同じ理由で記録</button><button className="secondary" onClick={()=>setExcuse('')}>別の候補を見る</button></div></div>}</div>
    {(actualExcuse && (!repeated || repeatConfirmed || customExcuse)) && <div className="card reveal"><h2>「{actualExcuse}」の日でも、どこからなら始められそう？</h2><p className="muted">できたかどうかが分かる、小さな動作を選びます。</p><div className="step-list">{[...(profile.savedFirstSteps || []), ...STEP_SUGGESTIONS[profile.category]].filter((x,i,a)=>a.indexOf(x)===i).slice(0,6).map(x=><button key={x} className={firstStep===x?'step active':'step'} onClick={()=>{setFirstStep(x);setCustomStep('')}}>{x}</button>)}</div><label>今日に合わせて自分で書く<input value={customStep} onChange={e=>{setCustomStep(e.target.value);setFirstStep('')}} placeholder="例：参考文献を1件確認する" maxLength={70}/></label><label className="check"><input type="checkbox" checked={share} onChange={e=>setShare(e.target.checked)} />言い訳だけを匿名で「みんな」に公開する</label></div>}
    <button className="primary" disabled={!actualExcuse || !actualStep || (repeated && !repeatConfirmed)} onClick={submit}>今日の作戦を記録する</button><button className="text-btn center-btn" onClick={onCancel}>戻る</button></section>;
}

function PlanDone({ plan, onHome, onCommunity }) { return <section className="center stack"><div className="success-mark">✓</div><h1>今日の作戦を記録しました</h1><div className="card summary"><p className="eyebrow">止まりそうな理由</p><h2>{plan.predictedExcuse}</h2><p className="eyebrow top-space">今日の最初の一歩</p><h2>{plan.firstStepText}</h2></div><p>本当にこの予測どおりになるかは、まだ分かりません。</p><button className="primary" onClick={onHome}>ホームへ</button><button className="secondary" onClick={onCommunity}>みんなの言い訳を見る</button></section>; }

function Review({ record, profile, onSubmit }) {
  const [status, setStatus] = useState(''); const [continued, setContinued] = useState(false); const [match, setMatch] = useState(''); const [actual, setActual] = useState('');
  const excuses = [...new Set([...(profile.customExcuses || []), ...SYSTEM_EXCUSES])];
  function submit() {
    const payload = { outcomeStatus: status, continuedBeyondFirstStep: status==='acted' ? continued : false, predictionMatched: status==='not_done' ? match : null, actualExcuse: status==='not_done' && match==='no' ? actual.trim() : status==='not_done' && match==='yes' ? record.predictedExcuse : null };
    onSubmit(payload);
  }
  return <section className="stack"><div><p className="eyebrow">前回の振り返り</p><h1>結果を採点せず、起きたことを記録します</h1></div><div className="card summary"><p>前回の予測</p><h2>{record.predictedExcuse}</h2><p className="top-space">前回の最初の一歩</p><h2>{record.firstStepText}</h2></div><div className="card"><h2>どうなりましたか？</h2><div className="choice-list"><button className={status==='acted'?'choice active':'choice'} onClick={()=>setStatus('acted')}>最初の一歩を実行した</button><button className={status==='rested'?'choice active':'choice'} onClick={()=>setStatus('rested')}>事前に休むと決めた</button><button className={status==='not_done'?'choice active':'choice'} onClick={()=>setStatus('not_done')}>やろうと思っていたが実行しなかった</button><button className={status==='changed'?'choice active':'choice'} onClick={()=>setStatus('changed')}>状況が変わり、必要なくなった</button><button className={status==='unknown'?'choice active':'choice'} onClick={()=>setStatus('unknown')}>覚えていない／回答しない</button></div></div>
    {status==='acted' && <div className="card reveal"><h2>その後は？</h2><div className="choice-list"><button className={!continued?'choice active':'choice'} onClick={()=>setContinued(false)}>最初の一歩まで</button><button className={continued?'choice active':'choice'} onClick={()=>setContinued(true)}>その先も続けた</button></div></div>}
    {status==='not_done' && <div className="card reveal"><h2>実際の理由も「{record.predictedExcuse}」でしたか？</h2><div className="chips"><button className={match==='yes'?'chip active':'chip'} onClick={()=>setMatch('yes')}>同じ理由だった</button><button className={match==='no'?'chip active':'chip'} onClick={()=>setMatch('no')}>別の理由だった</button><button className={match==='unknown'?'chip active':'chip'} onClick={()=>setMatch('unknown')}>理由はよく分からない</button></div>{match==='no' && <><div className="chips small-chips">{excuses.slice(0,6).map(x=><button key={x} className={actual===x?'chip active':'chip'} onClick={()=>setActual(x)}>{x}</button>)}</div><label>別の理由を書く<input value={actual} onChange={e=>setActual(e.target.value)} maxLength={70}/></label></>}</div>}
    <button className="primary" disabled={!status || (status==='not_done' && !match) || (status==='not_done' && match==='no' && !actual.trim())} onClick={submit}>振り返りを保存する</button></section>;
}

function Reflection({ record, onNext, onHome }) {
  let title='記録しました。'; let message='次に開いた日から、また考えられます。';
  if(record.outcomeStatus==='acted'){title=record.continuedBeyondFirstStep?'予測より、その先まで動けました。':'最初の一歩を実行できました。';message=`「${record.predictedExcuse}」と予測した日にも、${record.firstStepText}ができました。`;}
  if(record.outcomeStatus==='rested'){title='休息を選んだ記録です。';message='休んだことも、最近のペースを考えるための記録です。';}
  if(record.outcomeStatus==='not_done' && record.predictionMatched==='yes'){title='予測した理由と一致しました。';message='自分が止まりやすい条件に気づいた記録です。';}
  if(record.outcomeStatus==='not_done' && record.predictionMatched==='no'){title='予測とは別の理由がありました。';message='次の作戦を考えるための新しい発見です。';}
  return <section className="center stack"><div className="reflection-mark">◌</div><h1>{title}</h1><p className="lead">{message}</p><button className="primary" onClick={onNext}>今日の作戦を考える</button><button className="text-btn" onClick={onHome}>あとで考える</button></section>;
}

function ResultLine({r}){if(r.outcomeStatus==='acted')return <p className="insight">予測より動けた記録です。</p>;if(r.outcomeStatus==='rested')return <p className="insight blue">意識的に休んだ記録です。</p>;if(r.outcomeStatus==='not_done')return <p className="insight coral">実行しなかった理由を記録しました。</p>;return <p className="insight gray">状況の変化を記録しました。</p>}

function Community({ posts, category, onReact, onBack }) { return <section className="stack"><div><p className="eyebrow">お楽しみ・共感の補助機能</p><h1>みんなの言い訳</h1><p>同じジャンルの匿名投稿です。コメント・ランキング・個別チャットはありません。</p></div>{posts.filter(p=>p.category===category).length===0 && <div className="card"><p>まだ同じジャンルの公開投稿がありません。</p></div>}{posts.filter(p=>p.category===category).map(p=><article className="post" key={p.id}><span>{CATEGORY_LABELS[p.category] || 'その他'}</span><p>{p.excuseText}</p><div className="row"><button onClick={()=>onReact(p,'relate')}>わかる {p.reactions?.relate || 0}</button><button onClick={()=>onReact(p,'novel')}>その発想はなかった {p.reactions?.novel || 0}</button></div></article>)}<button className="secondary" onClick={onBack}>戻る</button></section> }

export default App;
