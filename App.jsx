import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db, firebaseReady, ensureAnonymousUser } from './firebase.js';

// 生活習慣の定番のつまずき（今日できなかったことの代表例）
const HABIT_EXCUSES = [
  '夜更かし・スマホの見すぎ',
  '二度寝・朝起きられない',
  '部屋の片付け・掃除の後回し',
  '夜遅くの間食・食べすぎ',
  '運動・ストレッチのサボり',
  '勉強やタスクの先延ばし'
];

// 生活習慣改善のための「最初のごく小さな一歩」プリセット
const HABIT_STEPS = [
  'ベッドに入ってスマホを充電器に置く',
  'アラームが鳴ったらまず上半身を起こす',
  '机の上の物を1つだけ元の場所に戻す',
  'コップ1杯の白湯か水を飲む',
  '運動着に着替える（または1回だけ伸びをする）',
  'ノートか教材を1回開くだけにする',
  'タイマーを1分だけセットして始める'
];

const SK = 'mindameParticipantCodeV53';
const DEMO_MODE = true;
const clean = v => v.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20);
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

export default function App() {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState('');
  const [code, setCode] = useState(localStorage.getItem(SK) || '');
  const [codeIn, setCodeIn] = useState('');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('home');
  const [flow, setFlow] = useState(null);
  const [shareDraft, setShareDraft] = useState(null);
  const [toast, setToast] = useState('');

  const msg = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2200);
  };

  useEffect(() => {
    if (!firebaseReady) return;
    ensureAnonymousUser().then(u => {
      setUid(u.uid);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready && uid && code) loadAll();
  }, [ready, uid, code]);

  useEffect(() => {
    const f = () => {
      if (uid && code && !flow) loadAll();
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [uid, code, flow]);

  async function loadAll() {
    setLoading(true);
    const pr = doc(db, 'participantsV4', uid);
    const ps = await getDoc(pr);
    setProfile(ps.exists() ? ps.data() : null);
    if (ps.exists()) {
      const rs = await getDocs(collection(pr, 'records'));
      setRecords(
        rs.docs
          .map(x => ({ id: x.id, ...x.data() }))
          .sort((a, b) => (b.recordDate || '').localeCompare(a.recordDate || ''))
      );
    }
    setLoading(false);
  }

  function enter() {
    const c = clean(codeIn);
    if (c.length < 3) return msg('参加コードを確認してください。');
    localStorage.setItem(SK, c);
    setCode(c);
  }

  async function onboard(v) {
    const d = {
      ...v,
      ownerUid: uid,
      participantCode: code,
      appVersion: 5.4,
      category: 'lifestyle',
      customExcuses: v.excuses,
      savedFirstSteps: HABIT_STEPS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'participantsV4', uid), d);
    setProfile(d);
  }

  const pending = records.find(r => !r.outcomeStatus) || null;
  const current = DEMO_MODE ? pending : records.find(r => r.recordDate === today()) || null;

  async function savePlan(v) {
    const id = DEMO_MODE ? `${today()}-${Date.now()}` : today();
    const ref = doc(db, 'participantsV4', uid, 'records', id);
    if (!DEMO_MODE) {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        msg('今日の改善作戦は記録済みです。');
        setFlow(null);
        return loadAll();
      }
    }
    const d = {
      ownerUid: uid,
      participantCode: code,
      appVersion: 5.4,
      recordDate: today(),
      predictedExcuse: v.excuse,
      firstStepText: v.step,
      outcomeStatus: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, d);
    const updates = {};
    if (v.newExcuse) {
      updates.customExcuses = [...(profile.customExcuses || []), v.excuse]
        .filter((x, i, a) => a.indexOf(x) === i)
        .slice(-20);
    }
    updates.savedFirstSteps = [v.step, ...(profile.savedFirstSteps || [])]
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, 20);
    await updateDoc(doc(db, 'participantsV4', uid), updates);
    setProfile(p => ({ ...p, ...updates }));
    await loadAll();
    setShareDraft({ recordId: id, excuse: v.excuse, step: v.step });
    setFlow('publish');
    msg('今日の改善作戦を記録しました。');
  }

  async function publishExcuse(share) {
    if (share) {
      await addDoc(collection(db, 'publicPostsV4'), {
        ownerUid: uid,
        category: 'lifestyle',
        goalText: profile.goalText || '生活習慣を整える',
        excuseText: shareDraft.excuse,
        firstStepText: shareDraft.step,
        isVisible: true,
        createdAt: serverTimestamp()
      });
    }
    setShareDraft(null);
    setFlow(null);
    setTab('home');
    if (share) msg('匿名で共有しました。');
  }

  async function saveReview(v) {
    const ref = doc(db, 'participantsV4', uid, 'records', pending.id);
    await updateDoc(ref, {
      ...v,
      updatedAt: serverTimestamp(),
      reviewedAt: serverTimestamp()
    });
    if (v.addActualToLibrary && v.actualExcuse) {
      const xs = [...(profile.customExcuses || []), v.actualExcuse]
        .filter((x, i, a) => a.indexOf(x) === i)
        .slice(-20);
      await updateDoc(doc(db, 'participantsV4', uid), { customExcuses: xs });
      setProfile(p => ({ ...p, customExcuses: xs }));
    }
    await loadAll();
    setFlow(null);
    setTab('home');
    msg('振り返りを記録しました。');
  }

  async function loadCommunity() {
    const snap = await getDocs(
      query(collection(db, 'publicPostsV4'), where('isVisible', '==', true), limit(50))
    );
    const all = snap.docs.map(x => ({ id: x.id, ...x.data() }));
    await Promise.all(
      all.map(async p => {
        const reactions = await getDocs(collection(db, 'publicPostsV4', p.id, 'reactions'));
        p.seedCount = reactions.docs.filter(x => x.data().type === 'seed').length;
        p.myReaction = reactions.docs.some(x => x.id === uid && x.data().type === 'seed')
          ? 'seed'
          : null;
      })
    );
    setPosts(all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
  }

  useEffect(() => {
    if (tab === 'community' && uid) loadCommunity();
  }, [tab, uid]);

  async function react(post) {
    const wasSelected = post.myReaction === 'seed';
    const nextSelected = !wasSelected;
    setPosts(list =>
      list.map(p =>
        p.id === post.id
          ? {
              ...p,
              myReaction: nextSelected ? 'seed' : null,
              seedCount: Math.max(0, (p.seedCount || 0) + (nextSelected ? 1 : -1))
            }
          : p
      )
    );
    const ref = doc(db, 'publicPostsV4', post.id, 'reactions', uid);
    try {
      if (wasSelected) await deleteDoc(ref);
      else await setDoc(ref, { ownerUid: uid, type: 'seed', createdAt: serverTimestamp() });
    } catch (e) {
      setPosts(list =>
        list.map(p =>
          p.id === post.id
            ? {
                ...p,
                myReaction: wasSelected ? 'seed' : null,
                seedCount: Math.max(0, (p.seedCount || 0) + (wasSelected ? 1 : -1))
              }
            : p
        )
      );
      msg('リアクションを保存できませんでした。');
    }
  }

  async function hidePost(post) {
    if (post.ownerUid !== uid) return;
    await updateDoc(doc(db, 'publicPostsV4', post.id), { isVisible: false });
    await loadCommunity();
  }

  if (!firebaseReady)
    return (
      <Shell>
        <Card>
          <h1>Firebase設定を確認してください</h1>
        </Card>
      </Shell>
    );
  if (!ready)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (!code)
    return (
      <Shell>
        <Entry value={codeIn} setValue={setCodeIn} enter={enter} />
      </Shell>
    );
  if (loading)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (!profile)
    return (
      <Shell>
        <Onboard submit={onboard} />
      </Shell>
    );
  if (flow === 'plan')
    return (
      <Shell>
        <Plan
          profile={profile}
          records={records}
          previous={records[0]?.predictedExcuse}
          save={savePlan}
          back={() => setFlow(null)}
        />
      </Shell>
    );
  if (flow === 'publish' && shareDraft)
    return (
      <Shell>
        <PublicExcuse draft={shareDraft} profile={profile} publish={publishExcuse} />
      </Shell>
    );
  if (flow === 'review')
    return (
      <Shell>
        <Review item={pending} profile={profile} save={saveReview} back={() => setFlow(null)} />
      </Shell>
    );

  return (
    <Shell profile={profile} toast={toast}>
      <div className="page">
        {tab === 'home' && (
          <Home
            pending={pending}
            current={current}
            records={records}
            review={() => setFlow('review')}
            plan={() => setFlow('plan')}
          />
        )}
        {tab === 'excuses' && <MyRecords records={records} profile={profile} />}
        {tab === 'community' && (
          <Community posts={posts} uid={uid} react={react} hidePost={hidePost} />
        )}
      </div>
      <Nav tab={tab} setTab={setTab} />
    </Shell>
  );
}

function Shell({ children, profile, toast }) {
  return (
    <div className="shell">
      <header>
        <b>
          みんだめ<span>生活習慣改善</span>
        </b>
      </header>
      <main>{children}</main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Card({ children, className = '' }) {
  return <section className={'card ' + className}>{children}</section>;
}

function Loading() {
  return (
    <div className="center">
      <div className="loader" />
      <p>生活習慣ログを確認しています...</p>
    </div>
  );
}

function Entry({ value, setValue, enter }) {
  return (
    <div className="entry">
      <p className="eyebrow">乱れた生活習慣を整える、最初の一歩</p>
      <h1>みんだめ</h1>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '14px' }}>
        睡眠・起床・片付け・食生活・運動・スマホ依存・先延ばしなどの生活改善をサポートします。
      </p>
      <label>
        参加コード
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="例：HABIT-01" />
      </label>
      <button className="primary" onClick={enter}>
        はじめる
      </button>
      <small>本名や個人情報は入力しないでください。</small>
    </div>
  );
}

function Onboard({ submit }) {
  const [goal, setGoal] = useState('生活リズムを整えて健康的に過ごす');
  const [xs, setXs] = useState([]);
  const [extra, setExtra] = useState('');
  const [ok, setOk] = useState(false);

  const toggle = x =>
    setXs(a => (a.includes(x) ? a.filter(v => v !== x) : a.length < 3 ? [...a, x] : a));
  const add = () => {
    const x = extra.trim();
    if (x && xs.length < 3 && !xs.includes(x)) {
      setXs(a => [...a, x]);
      setExtra('');
    }
  };

  return (
    <div className="stack">
      <h1>最初の設定</h1>
      <Card>
        <label className="check">
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />
          利用説明を確認し、生活改善サポート機能の利用に同意します
        </label>
      </Card>
      <Card>
        <h2>改善したい生活習慣・目標</h2>
        <label>
          目標
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="例：夜12時前に寝る、朝すっきり起きる、部屋を片付ける"
          />
        </label>
      </Card>
      <Card>
        <div className="count-head">
          <h2>つまずきやすい生活習慣を3つ選択</h2>
          <b>{xs.length}/3</b>
        </div>
        <p className="muted">日頃「今日できなかった…」となりがちな生活習慣を選んでください。</p>
        <div className="chips">
          {HABIT_EXCUSES.map(x => (
            <button
              key={x}
              className={xs.includes(x) ? 'chip on' : 'chip'}
              disabled={!xs.includes(x) && xs.length >= 3}
              onClick={() => toggle(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="add-row">
          <input
            value={extra}
            onChange={e => setExtra(e.target.value)}
            placeholder="その他の習慣（例: 朝ごはんを抜く）"
            maxLength={60}
          />
          <button
            className="secondary"
            disabled={!extra.trim() || xs.length >= 3}
            onClick={add}
          >
            追加
          </button>
        </div>
        {xs.length > 0 && (
          <div className="selected-list">
            {xs.map(x => (
              <button key={x} onClick={() => setXs(a => a.filter(v => v !== x))}>
                {x}
                <span>×</span>
              </button>
            ))}
          </div>
        )}
      </Card>
      <button
        className="primary"
        disabled={!ok || !goal || xs.length !== 3}
        onClick={() => submit({ goalText: goal, excuses: xs })}
      >
        設定を保存してスタート
      </button>
    </div>
  );
}

function Home({ pending, current, records, review, plan }) {
  const stats = useMemo(() => {
    let moved = 0,
      match = 0,
      other = 0;
    records.forEach(r => {
      if (r.outcomeStatus === 'acted') moved++;
      else if (r.outcomeStatus === 'not_done' && r.predictionMatched === 'yes') match++;
      else if (r.outcomeStatus === 'not_done' && r.predictionMatched === 'no') other++;
    });
    return { moved, match, other, total: moved + match + other };
  }, [records]);

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">生活習慣改善</p>
        <h1>今日の記録</h1>
      </div>
      <Card className={pending ? 'attention' : ''}>
        <h2>習慣の振り返り</h2>
        {pending ? (
          <>
            <p className="pair">
              <span>つまずき予測</span>
              <b>{pending.predictedExcuse}</b>
            </p>
            <p className="pair">
              <span>最初の一歩</span>
              <b>{pending.firstStepText}</b>
            </p>
            <button className="primary" onClick={review}>
              今日を振り返る
            </button>
          </>
        ) : (
          <p className="muted">未完了の振り返りはありません。</p>
        )}
      </Card>
      <Card>
        <h2>今日の生活改善作戦</h2>
        {current ? (
          <>
            <p className="plan-sentence">
              「{current.predictedExcuse}」となりそうな日でも、
              <br />
              <strong>{current.firstStepText}</strong>ならできるかも。
            </p>
            <span className="done">今日の作戦設定済み</span>
          </>
        ) : (
          <>
            <p>
              今日できなかったり乱れたりしそうな生活習慣を先回りして意識し、無理のない「小さな最初の一歩」を決めましょう。
            </p>
            <button className="primary" onClick={plan}>
              今日の改善作戦を決める
            </button>
          </>
        )}
      </Card>
      <Pattern stats={stats} />
    </div>
  );
}

function Pattern({ stats }) {
  if (!stats.total)
    return (
      <Card>
        <h2>最近の習慣改善実績</h2>
        <p className="muted">記録が増えると、ここに習慣の改善バランスが表示されます。</p>
      </Card>
    );
  return (
    <Card>
      <h2>最近の習慣改善実績</h2>
      <div className="bar">
        <i className="moved" style={{ width: `${(stats.moved / stats.total) * 100}%` }} />
        <i className="match" style={{ width: `${(stats.match / stats.total) * 100}%` }} />
        <i className="other" style={{ width: `${(stats.other / stats.total) * 100}%` }} />
      </div>
      <div className="legend">
        <span>
          <i className="dot moved" />
          一歩を踏み出せた <b>{stats.moved}</b>
        </span>
        <span>
          <i className="dot match" />
          予測した理由でつまずいた <b>{stats.match}</b>
        </span>
        <span>
          <i className="dot other" />
          別の理由で乱れた <b>{stats.other}</b>
        </span>
      </div>
    </Card>
  );
}

function Plan({ profile, records, previous, save, back }) {
  const [e, setE] = useState('');
  const [other, setOther] = useState('');
  const [step, setStep] = useState('');
  const [custom, setCustom] = useState('');
  const [confirm, setConfirm] = useState(false);

  const opts = [...new Set(profile.customExcuses || HABIT_EXCUSES)];
  const excuse = other.trim() || e;
  const first = custom.trim() || step;
  const repeated = excuse && excuse === previous;

  const stepStats = useMemo(() => {
    const map = {};
    records.forEach((r, i) => {
      if (!r.firstStepText) return;
      const o = map[r.firstStepText] || { text: r.firstStepText, count: 0, last: 0 };
      o.count++;
      o.last = Math.max(o.last, Number((r.createdAt?.seconds || 0) * 1000) || records.length - i);
      map[r.firstStepText] = o;
    });
    return Object.values(map);
  }, [records]);

  const recent = [...stepStats]
    .sort((a, b) => b.last - a.last)
    .slice(0, 3)
    .map(x => x.text);
  const frequent = [...stepStats]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .map(x => x.text)
    .filter(x => !recent.includes(x))
    .slice(0, 3);
  const recommended = [...new Set(HABIT_STEPS)]
    .filter(x => !recent.includes(x) && !frequent.includes(x))
    .slice(0, 4);

  const StepGroup = ({ title, items }) =>
    items.length ? (
      <div className="step-group">
        <h3>{title}</h3>
        <div className="choices">
          {items.map(x => (
            <button
              key={x}
              className={step === x ? 'choice on' : 'choice'}
              onClick={() => {
                setStep(x);
                setCustom('');
              }}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="stack">
      <button className="back" onClick={back}>
        ← ホームへ
      </button>
      <h1>今日の生活改善作戦</h1>
      <Card>
        <h2>今日、つまずきそうな生活習慣は？</h2>
        <div className="chips">
          {opts.map(x => (
            <button
              key={x}
              className={e === x ? 'chip on' : 'chip'}
              onClick={() => {
                setE(x);
                setOther('');
                setConfirm(false);
              }}
            >
              {x}
              {x === previous && <small>前回も選択</small>}
            </button>
          ))}
        </div>
        <label>
          今日できなかったこと・つまずきを直接入力
          <input
            value={other}
            onChange={x => {
              setOther(x.target.value);
              setE('');
            }}
            placeholder="例：夜更かししてベッドでSNSを見続けた"
          />
        </label>
        {repeated && !confirm && (
          <div className="notice">
            <p>前回も「{excuse}」でした。</p>
            <button className="secondary" onClick={() => setConfirm(true)}>
              同じ理由で記録する
            </button>
          </div>
        )}
      </Card>
      {excuse && (!repeated || confirm || other) && (
        <Card>
          <h2>「{excuse}」となりそうな時でも、これならできる最初の一歩は？</h2>
          <StepGroup title="最近実践した一歩" items={recent} />
          <StepGroup title="よく実践する一歩" items={frequent} />
          <StepGroup title="おすすめの生活習慣ステップ" items={recommended} />
          <label>
            自分で一歩を書く
            <input
              value={custom}
              onChange={x => {
                setCustom(x.target.value);
                setStep('');
              }}
              placeholder="例：スマホを机に置いて水だけ飲む"
            />
            <small>ハードルを極限まで下げた、1分以内でできる動作にしましょう。</small>
          </label>
        </Card>
      )}
      <button
        className="primary"
        disabled={!excuse || !first || (repeated && !confirm)}
        onClick={() => save({ excuse, step: first, newExcuse: !!other.trim() })}
      >
        作戦を記録する
      </button>
    </div>
  );
}

function PublicExcuse({ draft, profile, publish }) {
  return (
    <div className="stack">
      <p className="eyebrow">みんなで生活改善</p>
      <h1>今日の生活作戦を匿名共有する？</h1>
      <Card>
        <p className="muted">
          同じように生活習慣改善を目指す仲間に匿名で共有されます。個人情報は含まれません。
        </p>
        <div className="share-context">
          <span className="genre lifestyle">生活改善</span>
          <strong>{profile.goalText || '生活習慣を整える'}</strong>
        </div>
        <div className="share-preview">
          <span>共有される改善作戦</span>
          <p className="plan-sentence compact">
            「{draft.excuse}」となりそうな日でも、
            <br />
            <strong>{draft.step}</strong>ならできるかも。
          </p>
        </div>
      </Card>
      <button className="primary" onClick={() => publish(true)}>
        匿名で共有する
      </button>
      <button className="secondary" onClick={() => publish(false)}>
        共有しない
      </button>
    </div>
  );
}

function Review({ item, profile, save, back }) {
  const [status, setStatus] = useState('');
  const [continued, setContinued] = useState(false);
  const [match, setMatch] = useState('');
  const [actual, setActual] = useState('');
  const [addActual, setAddActual] = useState(true);

  const actualOptions = [...new Set([...(profile.customExcuses || []), ...HABIT_EXCUSES])];

  return (
    <div className="stack">
      <button className="back" onClick={back}>
        ← ホームへ
      </button>
      <h1>習慣の振り返り</h1>
      <Card>
        <p className="pair">
          <span>つまずき予測</span>
          <b>{item.predictedExcuse}</b>
        </p>
        <p className="pair">
          <span>最初の一歩</span>
          <b>{item.firstStepText}</b>
        </p>
      </Card>
      <Card>
        <h2>最初の一歩は実践できましたか？</h2>
        <div className="choices">
          <button
            className={status === 'acted' ? 'choice on' : 'choice'}
            onClick={() => setStatus('acted')}
          >
            実践できた
          </button>
          <button
            className={status === 'not_done' ? 'choice on' : 'choice'}
            onClick={() => setStatus('not_done')}
          >
            できなかった
          </button>
        </div>
        <div className="minor">
          <button onClick={() => setStatus('changed')}>生活予定が変わった</button>
          <button onClick={() => setStatus('unknown')}>今回はスキップ</button>
        </div>
      </Card>
      {status === 'acted' && (
        <Card>
          <h2>どこまで進められましたか？</h2>
          <div className="choices">
            <button
              className={!continued ? 'choice on' : 'choice'}
              onClick={() => setContinued(false)}
            >
              決めた一歩まで実践できた
            </button>
            <button
              className={continued ? 'choice on' : 'choice'}
              onClick={() => setContinued(true)}
            >
              勢いでその先の生活習慣も続けられた！
            </button>
          </div>
        </Card>
      )}
      {status === 'not_done' && (
        <Card>
          <h2>できなかった原因に「{item.predictedExcuse}」は当てはまりましたか？</h2>
          <div className="choices">
            <button
              className={match === 'yes' ? 'choice on' : 'choice'}
              onClick={() => setMatch('yes')}
            >
              当てはまった
            </button>
            <button
              className={match === 'no' ? 'choice on' : 'choice'}
              onClick={() => setMatch('no')}
            >
              別の生活習慣の乱れ・原因だった
            </button>
            <button
              className={match === 'unknown' ? 'choice on' : 'choice'}
              onClick={() => setMatch('unknown')}
            >
              よく分からない
            </button>
          </div>
          {match === 'no' && (
            <>
              <h3>実際にはどの原因が近かったですか？</h3>
              <div className="chips">
                {actualOptions.map(x => (
                  <button
                    key={x}
                    className={actual === x ? 'chip on' : 'chip'}
                    onClick={() => setActual(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <label>
                ほかの原因を入力
                <input
                  value={actual}
                  onChange={e => setActual(e.target.value)}
                  placeholder="例：疲れてそのまま寝落ちした"
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={addActual}
                  onChange={e => setAddActual(e.target.checked)}
                />
                この原因をつまずきリストに追加する
              </label>
            </>
          )}
        </Card>
      )}
      <button
        className="primary"
        disabled={
          !status ||
          (status === 'not_done' && !match) ||
          (match === 'no' && !actual.trim())
        }
        onClick={() =>
          save({
            outcomeStatus: status,
            continuedBeyondFirstStep: status === 'acted' && continued,
            predictionMatched: status === 'not_done' ? match : null,
            actualExcuse:
              match === 'yes'
                ? item.predictedExcuse
                : match === 'no'
                ? actual.trim()
                : null,
            addActualToLibrary: match === 'no' && addActual
          })
        }
      >
        振り返りを保存する
      </button>
    </div>
  );
}

function MyRecords({ records, profile }) {
  const [view, setView] = useState('reasons');
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">習慣分析</p>
        <h1>{view === 'reasons' ? 'つまずいた生活習慣' : '効果があった最初の一歩'}</h1>
      </div>
      <div className="record-switch">
        <button
          className={view === 'reasons' ? 'on' : ''}
          onClick={() => setView('reasons')}
        >
          つまずいた生活習慣
        </button>
        <button
          className={view === 'steps' ? 'on' : ''}
          onClick={() => setView('steps')}
        >
          効果があった最初の一歩
        </button>
      </div>
      {view === 'reasons' ? (
        <ReasonList records={records} profile={profile} />
      ) : (
        <StepList records={records} />
      )}
    </div>
  );
}

function ReasonList({ records, profile }) {
  const data = useMemo(() => {
    const map = {};
    (profile.customExcuses || HABIT_EXCUSES).forEach(x => {
      if (x) map[x] = 0;
    });
    const add = x => {
      if (!x) return;
      map[x] = (map[x] || 0) + 1;
    };
    records.forEach(r => {
      if (r.outcomeStatus !== 'not_done') return;
      if (r.predictionMatched === 'yes') add(r.predictedExcuse);
      if (r.predictionMatched === 'no') add(r.actualExcuse);
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));
  }, [records, profile]);

  return (
    <>
      <p className="muted">実際に乱れた・できなかった回数が多い生活習慣順です。</p>
      {data.length === 0 ? (
        <Card>
          <p className="muted">まだ記録された習慣の乱れがありません。</p>
        </Card>
      ) : (
        data.map((x, i) => (
          <Card key={x.name}>
            <div className="rank">
              <b>{i + 1}</b>
              <h2>{x.name}</h2>
              <strong>{x.count}回</strong>
            </div>
          </Card>
        ))
      )}
    </>
  );
}

function StepList({ records }) {
  const data = useMemo(() => {
    const map = {};
    records.forEach((r, i) => {
      if (!r.firstStepText) return;
      const x = map[r.firstStepText] || {
        name: r.firstStepText,
        setCount: 0,
        doneCount: 0,
        continuedCount: 0,
        last: 0,
        excuses: {}
      };
      x.setCount++;
      x.last = Math.max(x.last, r.createdAt?.seconds || records.length - i);
      if (r.outcomeStatus === 'acted') {
        x.doneCount++;
        if (r.continuedBeyondFirstStep) x.continuedCount++;
        if (r.predictedExcuse)
          x.excuses[r.predictedExcuse] = (x.excuses[r.predictedExcuse] || 0) + 1;
      }
      map[r.firstStepText] = x;
    });
    return Object.values(map)
      .map(x => ({
        ...x,
        topExcuses: Object.entries(x.excuses)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
          .slice(0, 3)
      }))
      .sort(
        (a, b) =>
          b.doneCount - a.doneCount ||
          b.continuedCount - a.continuedCount ||
          b.last - a.last
      );
  }, [records]);

  return (
    <>
      <p className="muted">
        実践できた回数が多い最初の一歩です。どんな生活習慣の乱れに効果があったかも確認できます。
      </p>
      {data.length === 0 ? (
        <Card>
          <p className="muted">まだ最初の一歩を実践した記録がありません。</p>
        </Card>
      ) : (
        data.map((x, i) => (
          <Card key={x.name}>
            <div className="rank">
              <b>{i + 1}</b>
              <h2>{x.name}</h2>
              <strong>{x.doneCount}回</strong>
            </div>
            <div className="step-stats">
              <span>
                作戦にした <b>{x.setCount}</b>
              </span>
              <span>
                実践できた <b>{x.doneCount}</b>
              </span>
              <span>
                その先も続いた <b>{x.continuedCount}</b>
              </span>
            </div>
            {x.topExcuses.length > 0 && (
              <div className="excuse-links">
                <small>効果のあった生活習慣の乱れ</small>
                {x.topExcuses.map(([name, count]) => (
                  <span key={name}>
                    「{name}」 <b>{count}回</b>
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </>
  );
}

function Community({ posts, uid, react, hidePost }) {
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">みんなの生活改善ログ</p>
        <h1>今日の生活改善作戦</h1>
        <p className="muted">
          みんなが生活習慣改善のために立てた「つまずき予測と最初の一歩」です。
        </p>
      </div>
      {posts.length === 0 ? (
        <Card>
          <p className="muted">まだ共有された生活改善ログがありません。</p>
        </Card>
      ) : (
        posts.map(p => (
          <Post key={p.id} post={p} uid={uid} react={react} hidePost={hidePost} />
        ))
      )}
    </div>
  );
}

function Post({ post, uid, react, hidePost }) {
  return (
    <Card className="post">
      <div className="post-head">
        <span className="genre lifestyle">生活改善</span>
        <strong title={post.goalText || ''}>{post.goalText || '生活習慣の改善'}</strong>
        {post.ownerUid === uid && <small className="yours">あなたの記録</small>}
      </div>
      <div className="community-plan sentence">
        <p>
          「{post.excuseText}」となりそうな日でも、
          <br />
          <strong>{post.firstStepText || '最初の一歩'}</strong>ならできるかも。
        </p>
      </div>
      <div className="reacts">
        <button
          aria-label="これなら踏み出せそう"
          className={post.myReaction === 'seed' ? 'selected seed-button' : 'seed-button'}
          onClick={() => react(post)}
        >
          🌱 これならできそう <span>{post.seedCount || 0}</span>
        </button>
      </div>
      {post.ownerUid === uid && (
        <button className="hide" onClick={() => hidePost(post)}>
          共有を取り消す
        </button>
      )}
    </Card>
  );
}

function Nav({ tab, setTab }) {
  return (
    <nav>
      <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}>
        <span>⌂</span>ホーム
      </button>
      <button className={tab === 'excuses' ? 'on' : ''} onClick={() => setTab('excuses')}>
        <span>▣</span>習慣分析
      </button>
      <button className={tab === 'community' ? 'on' : ''} onClick={() => setTab('community')}>
        <span>◌</span>みんなの作戦
      </button>
    </nav>
  );
}
