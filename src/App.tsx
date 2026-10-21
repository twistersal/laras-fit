import { useEffect, useMemo, useState } from 'react'
import {
  Activity, CalendarDays, Check, ChevronLeft, ChevronRight, CircleUserRound,
  Dumbbell, Flame, Footprints, Leaf, Plus, Save, Settings2, Utensils, Waves
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Bar, BarChart
} from 'recharts'
import { isSupabaseConfigured, supabase } from './supabase'

type DayLog = {
  date: string
  shift: 'P' | 'S' | 'M11'
  workoutType: string
  workoutStart: string
  workoutDone: boolean
  calories: number
  protein: number
  carbs: number
  fats: number
  steps: number
  vacuumRounds: number
  waterMl: number
  weightKg: number | null
  exercises: Record<string, { done: boolean; loadKg: number }>
  meals: { id: string; name: string; time: string; done: boolean }[]
  notes: string
}
type Tab = 'today' | 'calendar' | 'progress' | 'settings'

const plan: Record<string, { workout: string; title: string }> = {
  '1': { workout: 'lower_body_a', title: 'Lower Body A' },
  '2': { workout: 'core_and_cardio', title: 'Core & Cardio' },
  '3': { workout: 'lower_body_b', title: 'Lower Body B' },
  '4': { workout: 'active_rest', title: 'Active Rest' },
  '5': { workout: 'lower_body_a', title: 'Lower Body A' },
  '6': { workout: 'core_and_cardio', title: 'Core & Cardio' },
  '0': { workout: 'total_rest', title: 'Total Rest' },
}
const exercises: Record<string, string[]> = {
  lower_body_a: ['Backpack Hip Thrust · 4×15', 'Bulgarian Split Squat · 3×12/kaki', 'Towel Floor Bridge Abduction · 3×20'],
  lower_body_b: ['Backpack Romanian Deadlift · 3×15', 'Bulgarian Split Squat · 3×12/kaki', 'Towel Floor Bridge Abduction · 3×20'],
  core_and_cardio: ['Static Plank · 3×60 dtk', 'Side Plank · 3×45 dtk/sisi', 'LISS Fast Walk · 15–25 menit'],
  active_rest: ['Jalan santai / aktivitas kerja', 'Pemulihan dan mobilitas ringan'],
  total_rest: ['Istirahat penuh', 'Persiapan makanan untuk minggu berikutnya'],
}
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const defaultLog = (date: string): DayLog => {
  const day = String(new Date(`${date}T12:00:00`).getDay())
  const p = plan[day]
  const shift = day === '1' || day === '0' ? 'P' : (day === '4' || day === '6' ? 'M11' : 'S')
  const workoutStart = shift === 'P' ? '19:00' : shift === 'S' ? '09:00' : '20:30'
  const ex: Record<string, { done: boolean; loadKg: number }> = {}
  ;(exercises[p.workout] || []).forEach((name) => { ex[name] = { done: false, loadKg: 0 } })
  return {
    date, shift, workoutType: p.workout, workoutStart, workoutDone: false,
    calories: 0, protein: 0, carbs: 0, fats: 0, steps: 0, vacuumRounds: 0,
    waterMl: 0, weightKg: null, exercises: ex,
    meals: [
      { id: 'pre', name: 'Snack pra-latihan', time: shift === 'P' ? '17:00' : shift === 'S' ? '07:30' : '19:00', done: false },
      { id: 'post', name: 'Makan tinggi protein pasca-latihan', time: '', done: false },
      { id: 'other', name: 'Makan utama / camilan lain', time: '13:00', done: false },
    ], notes: '',
  }
}
function addMinutes(time: string, amount: number) {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + amount + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function weekDates(date: string) {
  const d = new Date(`${date}T12:00:00`)
  const mondayOffset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  })
}
function loadLocal(): Record<string, DayLog> {
  try { return JSON.parse(localStorage.getItem('laras-fit-logs') || '{}') } catch { return {} }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [logs, setLogs] = useState<Record<string, DayLog>>(loadLocal)
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [month, setMonth] = useState(() => `${todayISO().slice(0, 7)}`)
  const [targets, setTargets] = useState({ calories: 1800, protein: 125, steps: 8000 })

  const log = logs[selectedDate] || defaultLog(selectedDate)
  const setLog = (patch: Partial<DayLog>) => setLogs(prev => ({ ...prev, [selectedDate]: { ...(prev[selectedDate] || defaultLog(selectedDate)), ...patch } }))
  const currentWeek = useMemo(() => weekDates(selectedDate), [selectedDate])
  const weekData = useMemo(() => currentWeek.map(date => {
    const l = logs[date] || defaultLog(date)
    return { date, day: new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'short' }), calories: l.calories, protein: l.protein, steps: l.steps, workout: l.workoutDone ? 1 : 0,
      load: Math.max(0, ...Object.values(l.exercises).map(x => x.loadKg)) }
  }), [currentWeek, logs])
  const totalWorkoutExercises = Object.keys(log.exercises).length
  const checkedExercises = Object.values(log.exercises).filter(x => x.done).length
  const completion = totalWorkoutExercises ? Math.round(checkedExercises / totalWorkoutExercises * 100) : 0

  useEffect(() => {
    localStorage.setItem('laras-fit-logs', JSON.stringify(logs))
  }, [logs])
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ? { email: data.session.user.email } : null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { email: session.user.email } : null))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || !user?.email) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('daily_logs').select('*').order('log_date')
      if (alive && data?.length) {
        const next: Record<string, DayLog> = {}
        data.forEach((row: any) => { next[row.log_date] = row.payload as DayLog })
        setLogs(prev => ({ ...prev, ...next }))
      }
    })()
    return () => { alive = false }
  }, [user?.email])

  const saveToCloud = async () => {
    if (!supabase || !user) { setNotice('Mode lokal aktif. Hubungkan Supabase dan masuk untuk menyinkronkan database.'); return }
    setBusy(true)
    const payload = { user_id: (await supabase.auth.getUser()).data.user?.id, log_date: selectedDate, payload: log }
    const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,log_date' })
    setBusy(false); setNotice(error ? `Gagal menyimpan: ${error.message}` : 'Log berhasil disimpan ke database.')
  }
  const signIn = async () => {
    if (!supabase) { setNotice('Lengkapi .env dengan URL dan anon key Supabase terlebih dahulu.'); return }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setBusy(false); setNotice(error ? error.message : 'Tautan masuk telah dikirim ke email jika alamat terdaftar.')
  }
  const updateExercise = (name: string, patch: Partial<{ done: boolean; loadKg: number }>) => {
    setLog({ exercises: { ...log.exercises, [name]: { ...(log.exercises[name] || { done: false, loadKg: 0 }), ...patch } } })
  }
  const updateMeal = (id: string, patch: Partial<DayLog['meals'][number]>) => setLog({ meals: log.meals.map(m => m.id === id ? { ...m, ...patch } : m) })
  const setWorkoutStart = (time: string) => setLog({ workoutStart: time, meals: log.meals.map(m => m.id === 'post' ? { ...m, time: addMinutes(time, 60) } : m) })
  const shiftOptions = [{ value: 'P', label: 'Pagi · 09.00–17.00' }, { value: 'S', label: 'Siang · 14.00–22.00' }, { value: 'M11', label: 'Middle · 11.00–19.00' }]
  const calendarCells = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(y, m - 1, 1).getDay()
    const count = new Date(y, m, 0).getDate()
    return [...Array((first + 6) % 7).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  }, [month])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Leaf size={21}/></div><div><b>LARAS <span>/ FIT</span></b><small>PERSONAL TRACKER</small></div></div>
      <div className="profile-mini"><div className="avatar"><CircleUserRound size={22}/></div><div><b>Personal space</b><small>{user?.email || 'Progress, not perfection'}</small></div></div>
      <nav>
        <button className={tab === 'today' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('today')}><Activity size={18}/> Ringkasan harian</button>
        <button className={tab === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('calendar')}><CalendarDays size={18}/> Kalender log</button>
        <button className={tab === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('progress')}><Waves size={18}/> Progres mingguan</button>
        <button className={tab === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('settings')}><Settings2 size={18}/> Akun & sinkronisasi</button>
      </nav>
      <div className="sidebar-bottom"><div className="status-dot"/><span>{isSupabaseConfigured ? (user ? 'Database terhubung' : 'Supabase siap · belum masuk') : 'Penyimpanan lokal aktif'}</span></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><div className="eyebrow">YOUR CONSISTENCY JOURNAL</div><h1>{tab === 'today' ? 'Hari ini, satu langkah.' : tab === 'calendar' ? 'Kalender progres' : tab === 'progress' ? 'Lihat perjalanannya.' : 'Pengaturan akun'}</h1></div>
        <div className="date-control"><button className="icon-button" onClick={() => setSelectedDate(d => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate()-1); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` })}><ChevronLeft size={17}/></button><button className="date-label" onClick={() => setSelectedDate(todayISO())}>{formatDate(selectedDate)}</button><button className="icon-button" onClick={() => setSelectedDate(d => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate()+1); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` })}><ChevronRight size={17}/></button></div>
      </header>

      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}>Tutup</button></div>}

      {tab === 'today' && <>
        <section className="hero-card"><div className="hero-copy"><div className="pill"><span/> DAILY CHECK-IN</div><h2>{plan[String(new Date(`${selectedDate}T12:00:00`).getDay())].title}</h2><p>{log.workoutType === 'active_rest' ? 'Gerak seperlunya, beri tubuh ruang untuk pulih.' : log.workoutType === 'total_rest' ? 'Hari untuk istirahat penuh dan menyiapkan minggu baru.' : 'Bangun konsistensi. Catat usaha, bukan hanya hasil.'}</p><div className="hero-meta"><span><CalendarDays size={15}/>{selectedDate}</span><span><Dumbbell size={15}/>{log.shift} shift</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-glyph">L<span>•</span>F</div><div className="hero-caption">STRONGER<br/>BY DESIGN</div></div></section>

        <section className="metric-grid">
          <div className="metric-card"><div className="metric-top"><span>Kalori</span><Flame size={17}/></div><div className="metric-value">{log.calories.toLocaleString('id-ID')}<small> / {targets.calories}</small></div><div className="progress-track"><div style={{width:`${Math.min(100,log.calories/targets.calories*100)}%`}}/></div><small className="muted">kkal dikonsumsi</small></div>
          <div className="metric-card"><div className="metric-top"><span>Protein</span><Utensils size={17}/></div><div className="metric-value">{log.protein}<small> / {targets.protein} g</small></div><div className="progress-track protein"><div style={{width:`${Math.min(100,log.protein/targets.protein*100)}%`}}/></div><small className="muted">target harian</small></div>
          <div className="metric-card"><div className="metric-top"><span>Langkah</span><Footprints size={17}/></div><div className="metric-value">{log.steps.toLocaleString('id-ID')}<small> / {targets.steps.toLocaleString('id-ID')}</small></div><div className="progress-track steps"><div style={{width:`${Math.min(100,log.steps/targets.steps*100)}%`}}/></div><small className="muted">langkah hari ini</small></div>
          <div className="metric-card"><div className="metric-top"><span>Latihan selesai</span><Dumbbell size={17}/></div><div className="metric-value">{completion}<small>%</small></div><div className="progress-track workout"><div style={{width:`${completion}%`}}/></div><small className="muted">{checkedExercises} dari {totalWorkoutExercises} item</small></div>
        </section>

        <div className="content-grid">
          <section className="panel workout-panel"><div className="panel-heading"><div><div className="eyebrow">MOVE WITH INTENTION</div><h3>Latihan hari ini</h3></div><span className="tag">{log.workoutType.replaceAll('_',' ')}</span></div>
            <div className="settings-row"><label>Shift kerja<select value={log.shift} onChange={e => { const s = e.target.value as DayLog['shift']; setLog({ shift:s }) }}>{shiftOptions.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select></label><label>Jam mulai workout<input type="time" value={log.workoutStart} onChange={e => setWorkoutStart(e.target.value)}/></label></div>
            <div className="exercise-list">{Object.keys(log.exercises).length ? Object.entries(log.exercises).map(([name, val])=><div className={`exercise-row ${val.done?'done':''}`} key={name}><button className={`check ${val.done?'checked':''}`} onClick={()=>updateExercise(name,{done:!val.done})}>{val.done&&<Check size={14}/>}</button><div className="exercise-name">{name}<small>{val.done?'Selesai':'Tandai jika selesai'}</small></div><label className="load-input"><input aria-label={`Beban ${name}`} type="number" min="0" step="0.5" value={val.loadKg} onChange={e=>updateExercise(name,{loadKg:Number(e.target.value)})}/><span>kg</span></label></div>) : <p className="muted">Belum ada item latihan.</p>}</div>
            <button className={`primary-button ${log.workoutDone?'is-done':''}`} onClick={()=>setLog({workoutDone:!log.workoutDone})}>{log.workoutDone?<Check size={16}/>:<Dumbbell size={16}/>} {log.workoutDone?'Latihan ditandai selesai':'Tandai sesi selesai'}</button>
          </section>

          <section className="panel nutrition-panel"><div className="panel-heading"><div><div className="eyebrow">FUEL & RECOVER</div><h3>Catatan nutrisi</h3></div><Utensils size={19}/></div>
            <div className="macro-grid">
              {[['Kalori','calories','kkal'],['Protein','protein','g'],['Karbohidrat','carbs','g'],['Lemak','fats','g']].map(([label,key,unit])=><label className="field" key={key}>{label}<div className="input-with-unit"><input type="number" min="0" value={log[key as keyof DayLog] as number} onChange={e=>setLog({[key]:Number(e.target.value)} as Partial<DayLog>)}/><span>{unit}</span></div></label>)}
            </div>
            <div className="meal-heading"><h4>Waktu makan otomatis</h4><span>berdasarkan workout</span></div>
            <div className="meal-list">{log.meals.map(meal=><div className="meal-row" key={meal.id}><button className={`check small-check ${meal.done?'checked':''}`} onClick={()=>updateMeal(meal.id,{done:!meal.done})}>{meal.done&&<Check size={12}/>}</button><div className="meal-name">{meal.name}<small>{meal.id==='post'?'Target maksimal 60 menit setelah workout':meal.id==='pre'?'Snack karbohidrat sebelum latihan':'Bisa diatur sesuai kebutuhan'}</small></div><input className="meal-time" aria-label={`Jam ${meal.name}`} type="time" value={meal.time} onChange={e=>updateMeal(meal.id,{time:e.target.value})}/></div>)}</div>
            <p className="hint">Jam makan pascalatihan otomatis diatur 60 menit setelah jam mulai workout. Sesuaikan bila durasi latihanmu berbeda.</p>
          </section>
        </div>
        <div className="content-grid lower-grid">
          <section className="panel"><div className="panel-heading"><div><div className="eyebrow">DAILY HABITS</div><h3>Kebiasaan & pemulihan</h3></div><Waves size={18}/></div>
            <div className="habit-row"><div className="habit-icon"><Footprints size={18}/></div><div className="habit-copy"><b>Langkah harian</b><small>Target minimum 8.000 langkah</small></div><input className="habit-number" type="number" min="0" value={log.steps} onChange={e=>setLog({steps:Number(e.target.value)})}/></div>
            <div className="habit-row"><div className="habit-icon"><Activity size={18}/></div><div className="habit-copy"><b>Stomach vacuum</b><small>5 ronde × 30 detik</small></div><div className="stepper"><button onClick={()=>setLog({vacuumRounds:Math.max(0,log.vacuumRounds-1)})}>−</button><b>{log.vacuumRounds}/5</b><button onClick={()=>setLog({vacuumRounds:Math.min(5,log.vacuumRounds+1)})}>+</button></div></div>
            <div className="habit-row"><div className="habit-icon"><Leaf size={18}/></div><div className="habit-copy"><b>Air minum</b><small>Catat total cairan harian (ml)</small></div><input className="habit-number" type="number" min="0" step="100" value={log.waterMl} onChange={e=>setLog({waterMl:Number(e.target.value)})}/></div>
            <label className="field notes-field">Catatan harian<textarea rows={3} value={log.notes} placeholder="Energi, rasa lapar, progres, atau hal yang ingin diingat..." onChange={e=>setLog({notes:e.target.value})}/></label>
          </section>
          <section className="panel save-panel"><div className="save-mark"><Save size={22}/></div><h3>Catat harimu.</h3><p>Log disimpan otomatis di perangkat ini. Simpan ke database untuk menyinkronkan antarperangkat setelah masuk.</p><button className="primary-button" onClick={saveToCloud} disabled={busy}>{busy?'Menyimpan…':<><Save size={16}/> Simpan ke database</>}</button><div className="storage-note"><span className="status-dot"/>{isSupabaseConfigured?(user?'Database siap disinkronkan':'Masuk dibutuhkan untuk cloud'): 'Mode lokal · data tersimpan di browser ini'}</div><button className="text-button" onClick={()=>setTab('progress')}>Lihat progres mingguan →</button></section>
        </div>
      </>}

      {tab === 'calendar' && <section className="panel calendar-panel"><div className="panel-heading"><div><div className="eyebrow">REAL DATES, REAL PROGRESS</div><h3>Kalender latihan & nutrisi</h3><p className="muted">Setiap tanggal memiliki log terpisah.</p></div><div className="month-switch"><button className="icon-button" onClick={()=>setMonth(m=>{const d=new Date(`${m}-15T12:00:00`);d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})}><ChevronLeft size={17}/></button><b>{new Date(`${month}-15T12:00:00`).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</b><button className="icon-button" onClick={()=>setMonth(m=>{const d=new Date(`${m}-15T12:00:00`);d.setMonth(d.getMonth()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})}><ChevronRight size={17}/></button></div></div>
        <div className="calendar-grid">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=><div className="calendar-weekday" key={x}>{x}</div>)}{calendarCells.map((date,i)=>date?<button key={date} className={`calendar-day ${date===selectedDate?'selected':''} ${date===todayISO()?'today':''} ${logs[date]?'has-log':''}`} onClick={()=>{setSelectedDate(date);setTab('today')}}><span>{Number(date.slice(-2))}</span>{logs[date]&&<i/>}</button>:<div key={`empty-${i}`} />)}</div>
        <div className="calendar-legend"><span><i className="legend-dot saved"/> Ada log tersimpan</span><span><i className="legend-dot current"/> Hari ini</span></div>
        <div className="calendar-summary"><h4>Minggu dari {formatDate(currentWeek[0])}</h4><div className="week-strip">{currentWeek.map(date=><button key={date} className={date===selectedDate?'week-day selected':''} onClick={()=>{setSelectedDate(date);setTab('today')}}><small>{new Date(`${date}T12:00:00`).toLocaleDateString('id-ID',{weekday:'short'})}</small><b>{date.slice(-2)}</b><span>{logs[date]?'●':'·'}</span></button>)}</div></div>
      </section>}

      {tab === 'progress' && <><section className="metric-grid progress-summary">
        <div className="metric-card"><div className="metric-top"><span>Rata-rata kalori</span><Flame size={17}/></div><div className="metric-value">{Math.round(weekData.reduce((a,b)=>a+b.calories,0)/7).toLocaleString('id-ID')}<small> kkal/hari</small></div><small className="muted">Target {targets.calories} kkal</small></div>
        <div className="metric-card"><div className="metric-top"><span>Rata-rata protein</span><Utensils size={17}/></div><div className="metric-value">{Math.round(weekData.reduce((a,b)=>a+b.protein,0)/7)}<small> g/hari</small></div><small className="muted">Target {targets.protein} g</small></div>
        <div className="metric-card"><div className="metric-top"><span>Total langkah</span><Footprints size={17}/></div><div className="metric-value">{weekData.reduce((a,b)=>a+b.steps,0).toLocaleString('id-ID')}</div><small className="muted">Target mingguan {(targets.steps*7).toLocaleString('id-ID')}</small></div>
        <div className="metric-card"><div className="metric-top"><span>Sesi selesai</span><Dumbbell size={17}/></div><div className="metric-value">{weekData.reduce((a,b)=>a+b.workout,0)}<small> / 7 hari</small></div><small className="muted">Berdasarkan status sesi</small></div>
      </section>
      <div className="charts-grid"><section className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">NUTRITION</div><h3>Kalori per hari</h3></div><span className="chart-unit">kkal</span></div><ResponsiveContainer width="100%" height={240}><AreaChart data={weekData} margin={{left:-18,right:8,top:10,bottom:0}}><defs><linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b8d8a4" stopOpacity={0.3}/><stop offset="100%" stopColor="#b8d8a4" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#2b322c"/><XAxis dataKey="day" stroke="#8b948b" tickLine={false} axisLine={false}/><YAxis stroke="#8b948b" tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#191f1a',border:'1px solid #364036',borderRadius:10}}/><Area type="monotone" dataKey="calories" name="Kalori" stroke="#b8d8a4" fill="url(#calorieFill)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">PROTEIN INTAKE</div><h3>Protein per hari</h3></div><span className="chart-unit">gram</span></div><ResponsiveContainer width="100%" height={240}><BarChart data={weekData} margin={{left:-18,right:8,top:10,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#2b322c"/><XAxis dataKey="day" stroke="#8b948b" tickLine={false} axisLine={false}/><YAxis stroke="#8b948b" tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#191f1a',border:'1px solid #364036',borderRadius:10}}/><Bar dataKey="protein" name="Protein" fill="#b8d8a4" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">DAILY MOVEMENT</div><h3>Langkah per hari</h3></div><span className="chart-unit">langkah</span></div><ResponsiveContainer width="100%" height={240}><BarChart data={weekData} margin={{left:-18,right:8,top:10,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#2b322c"/><XAxis dataKey="day" stroke="#8b948b" tickLine={false} axisLine={false}/><YAxis stroke="#8b948b" tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#191f1a',border:'1px solid #364036',borderRadius:10}}/><Bar dataKey="steps" name="Langkah" fill="#d8b98a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">STRENGTH LOG</div><h3>Beban tertinggi per hari</h3></div><span className="chart-unit">kg</span></div><ResponsiveContainer width="100%" height={240}><AreaChart data={weekData} margin={{left:-18,right:8,top:10,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#2b322c"/><XAxis dataKey="day" stroke="#8b948b" tickLine={false} axisLine={false}/><YAxis stroke="#8b948b" tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#191f1a',border:'1px solid #364036',borderRadius:10}}/><Area type="monotone" dataKey="load" name="Beban" stroke="#d8b98a" fill="#d8b98a" fillOpacity={0.15} strokeWidth={2.5}/></AreaChart></ResponsiveContainer></section></div>
      <section className="panel completion-panel"><div className="panel-heading"><div><div className="eyebrow">CONSISTENCY</div><h3>Penyelesaian sesi</h3></div></div><div className="completion-bars">{weekData.map(d=><div className="completion-day" key={d.date}><div className="completion-track"><i style={{height:d.workout?'100%':'5%'}}/></div><small>{d.day}</small><b>{d.workout?'✓':'—'}</b></div>)}</div></section></>}

      {tab === 'settings' && <div className="settings-layout"><section className="panel"><div className="eyebrow">ACCOUNT & CLOUD</div><h3>Sinkronisasi database</h3><p className="muted">Masuk dengan tautan email tanpa kata sandi. Kredensial Supabase disimpan pada file .env lokal dan tidak dimasukkan ke GitHub.</p>{isSupabaseConfigured?<><label className="field">Email<input type="email" placeholder="nama@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="primary-button" onClick={user?async()=>{await supabase?.auth.signOut();setUser(null);setNotice('Kamu sudah keluar dari akun.')} : signIn} disabled={busy}>{user?'Keluar dari akun':'Kirim tautan masuk'}</button><p className="muted">{user?`Masuk sebagai ${user.email}`:'Periksa email untuk tautan masuk.'}</p></>:<div className="setup-callout"><b>Supabase belum dikonfigurasi</b><p>Salin .env.example menjadi .env, lalu isi URL project dan anon key dari pengaturan Supabase.</p></div>}</section>
      <section className="panel"><div className="eyebrow">PERSONAL TARGETS</div><h3>Target harian</h3><div className="settings-targets"><label className="field">Kalori (kkal)<input type="number" value={targets.calories} onChange={e=>setTargets(p=>({...p,calories:Number(e.target.value)}))}/></label><label className="field">Protein (g)<input type="number" value={targets.protein} onChange={e=>setTargets(p=>({...p,protein:Number(e.target.value)}))}/></label><label className="field">Langkah<input type="number" value={targets.steps} onChange={e=>setTargets(p=>({...p,steps:Number(e.target.value)}))}/></label></div><p className="hint">Nilai awal mengikuti target personal: 1.750–1.850 kkal, protein 110–140 g, dan minimal 8.000 langkah. Angka target di sini digunakan untuk indikator dashboard.</p></section>
      <section className="panel"><div className="eyebrow">LOCAL DATA</div><h3>Ekspor catatan</h3><p className="muted">Unduh log yang tersimpan pada browser ini sebagai JSON untuk backup atau migrasi.</p><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify(logs,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`laras-fit-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url)}}><Save size={16}/> Ekspor backup JSON</button></section></div>}

      <footer className="footer"><span>LARAS / FIT</span><span>Consistency is a form of self-respect.</span><span>v1.0.0</span></footer>
    </main>
  </div>
}
