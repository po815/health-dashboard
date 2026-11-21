import { useState } from 'react'
import jsPDF from 'jspdf'
import './App.css'

function getToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatReading(row) {
  const dateString = String(row.reading_date).slice(0, 10)

  return {
    id: row.id,
    value: Number(row.glucose_value),
    slot: row.slot,
    reading_date: dateString,
    timestamp: new Date(`${dateString}T12:00:00`).getTime(),
    time: row.created_at
      ? new Date(row.created_at).toLocaleString()
      : dateString,
  }
}

function App() {
  const [isSignup, setIsSignup] = useState(false)
  const [isDashboard, setIsDashboard] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')

  const [glucose, setGlucose] = useState('')
  const [readingDate, setReadingDate] = useState(getToday())
  const [slot, setSlot] = useState('Before Breakfast')
  const [readings, setReadings] = useState([])
  const [readingMessage, setReadingMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // DAILY REPORT STATES
  const [reportDate, setReportDate] = useState(getToday())
  const [dailyReport, setDailyReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMessage, setReportMessage] = useState('')

  const slots = [
    'Before Breakfast',
    'After Breakfast',
    'Before Lunch',
    'After Lunch',
  ]

  // FETCH DAILY REPORT
  async function fetchDailyReport(date = reportDate, tokenOverride = null) {
    setReportLoading(true)
    setReportMessage('')
    setDailyReport(null)

    const token = tokenOverride || sessionStorage.getItem('token')

    if (!token) {
      setReportMessage('Please login again.')
      setReportLoading(false)
      return
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/reports/daily?date=${date}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setReportMessage(data.message || 'Unable to fetch daily report.')
        return
      }

      setDailyReport(data)
    } catch (error) {
      setReportMessage('Cannot connect to backend.')
    } finally {
      setReportLoading(false)
    }
  }

  // SIGNUP AND LOGIN
  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (isSignup) {
      if (!name || !email || !password || !confirmPassword) {
        setMessage('Please fill in all fields')
        return
      }

      if (password !== confirmPassword) {
        setMessage('Passwords do not match!')
        return
      }

      if (password.length < 8) {
        setMessage('Password must be at least 8 characters')
        return
      }

      try {
        const response = await fetch(
          'http://localhost:5000/api/auth/signup',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          setMessage(data.message || 'Signup failed')
          return
        }

        setMessage('Account created successfully! Please login.')
        setIsSignup(false)
        setPassword('')
        setConfirmPassword('')
      } catch (error) {
        setMessage('Cannot connect to backend.')
      }

      return
    }

    if (!email || !password) {
      setMessage('Please enter email and password')
      return
    }

    try {
      const response = await fetch(
        'http://localhost:5000/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Login failed')
        return
      }

      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(data.user))

      const readingsResponse = await fetch(
        'http://localhost:5000/api/readings',
        {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        }
      )

      const readingsData = await readingsResponse.json()

      if (readingsResponse.ok) {
        setReadings(readingsData.map(formatReading))
      } else {
        setReadings([])
        setReadingMessage('Unable to load saved readings.')
      }

      await fetchDailyReport(reportDate, data.token)

      setIsDashboard(true)
      setActivePage('dashboard')
      setMessage('')
    } catch (error) {
      setMessage('Cannot connect to backend. Please try again.')
    }
  }

  // ADD READING
  async function addReading(e) {
    e.preventDefault()
    setReadingMessage('')

    if (!glucose || Number(glucose) <= 0) {
      setReadingMessage('Enter a valid glucose value')
      return
    }

    if (!Number.isInteger(Number(glucose))) {
      setReadingMessage('Glucose value must be a whole number')
      return
    }

    if (!readingDate || !slot) {
      setReadingMessage('Select date and reading slot')
      return
    }

    const token = sessionStorage.getItem('token')

    if (!token) {
      setReadingMessage('Please login again')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        'http://localhost:5000/api/readings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reading_date: readingDate,
            slot,
            glucose_value: Number(glucose),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setReadingMessage(data.message || 'Failed to add reading')
        return
      }

      const newReading = formatReading(data.reading)

      setReadings((prev) =>
        [newReading, ...prev].sort(
          (a, b) =>
            b.reading_date.localeCompare(a.reading_date) ||
            b.timestamp - a.timestamp
        )
      )

      setGlucose('')
      setReadingMessage('Reading saved successfully! 💗')

      if (readingDate === reportDate) {
        await fetchDailyReport(reportDate)
      }
    } catch (error) {
      setReadingMessage('Cannot connect to backend.')
    } finally {
      setLoading(false)
    }
  }

  // DELETE READING
  async function deleteReading(id) {
    setReadingMessage('')

    const token = sessionStorage.getItem('token')

    try {
      const response = await fetch(
        `http://localhost:5000/api/readings/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setReadingMessage(data.message || 'Delete failed')
        return
      }

      setReadings((prev) =>
        prev.filter((reading) => reading.id !== id)
      )

      setReadingMessage('Reading deleted successfully!')

      await fetchDailyReport(reportDate)
    } catch (error) {
      setReadingMessage('Cannot connect to backend.')
    }
  }

  // LOGOUT
  function logout() {
    setIsDashboard(false)
    setActivePage('dashboard')
    setEmail('')
    setPassword('')
    setMessage('')
    setReadingMessage('')
    setReadings([])
    setDailyReport(null)
    setReportMessage('')

    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  // SWITCH LOGIN / SIGNUP
  function switchPage() {
    setIsSignup(!isSignup)
    setName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setMessage('')
  }

  // DASHBOARD STATISTICS
  const latest = readings.length > 0 ? readings[0].value : '--'

  const average =
    readings.length > 0
      ? Math.round(
          readings.reduce((total, item) => total + item.value, 0) /
            readings.length
        )
      : '--'

  // WEEKLY DATA
  const weeklyData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))

    const dayReadings = readings.filter((reading) => {
      const readingDateObj = new Date(reading.timestamp)

      return (
        readingDateObj.getDate() === date.getDate() &&
        readingDateObj.getMonth() === date.getMonth() &&
        readingDateObj.getFullYear() === date.getFullYear()
      )
    })

    const dailyAverage =
      dayReadings.length > 0
        ? Math.round(
            dayReadings.reduce((sum, item) => sum + item.value, 0) /
              dayReadings.length
          )
        : 0

    return {
      label: date.toLocaleDateString('en', { weekday: 'short' }),
      average: dailyAverage,
      count: dayReadings.length,
    }
  })

  const maxWeeklyValue = Math.max(
    ...weeklyData.map((day) => day.average),
    1
  )

  // DAILY REPORT CALCULATIONS
  const reportReadings = dailyReport?.readings || []

  const reportValues = reportReadings.map((item) =>
    Number(item.glucose_value)
  )

  const reportAverage =
    reportValues.length > 0
      ? (
          reportValues.reduce((sum, value) => sum + value, 0) /
          reportValues.length
        ).toFixed(2)
      : '--'

  const reportMinimum =
    reportValues.length > 0
      ? Math.min(...reportValues)
      : '--'

  const reportMaximum =
    reportValues.length > 0
      ? Math.max(...reportValues)
      : '--'
      // PROFESSIONAL DAILY REPORT PDF
function downloadDailyReport() {
  if (!dailyReport) {
    setReportMessage('No report available to download.')
    return
  }

  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()

  // HEADER
  doc.setFillColor(55, 91, 180)
  doc.rect(0, 0, pageWidth, 38, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('SWEETY', 20, 17)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Daily Glucose Report', 20, 27)

  // REPORT DATE
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Report Date:', 20, 50)

  doc.setFont('helvetica', 'normal')
  doc.text(reportDate, 48, 50)

  // SUMMARY TITLE
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Daily Summary', 20, 65)

  // SUMMARY CARDS
  const cardY = 72
  const cardWidth = 40
  const cardHeight = 28
  const gap = 7

  const summary = [
    ['Total', `${dailyReport.total_readings}`],
    ['Average', `${reportAverage} mg/dL`],
    ['Minimum', `${reportMinimum} mg/dL`],
    ['Maximum', `${reportMaximum} mg/dL`],
  ]

  summary.forEach((item, index) => {
    const x = 20 + index * (cardWidth + gap)

    doc.setFillColor(240, 245, 255)
    doc.roundedRect(
      x,
      cardY,
      cardWidth,
      cardHeight,
      3,
      3,
      'F'
    )

    doc.setTextColor(70, 90, 130)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(item[0], x + 4, cardY + 9)

    doc.setTextColor(35, 50, 90)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(item[1], x + 4, cardY + 20)
  })

  // READING TABLE TITLE
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Reading Details', 20, 115)

  // TABLE HEADER
  const tableY = 123

  doc.setFillColor(55, 91, 180)
  doc.rect(20, tableY, 170, 12, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')

  doc.text('Reading Slot', 25, tableY + 8)
  doc.text('Glucose Value', 125, tableY + 8)

  // TABLE ROWS
  let y = tableY + 12

  slots.forEach((currentSlot, index) => {
    const reading = reportReadings.find(
      (item) => item.slot === currentSlot
    )

    const value = reading
      ? `${reading.glucose_value} mg/dL`
      : 'No reading'

    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 255)
      doc.rect(20, y, 170, 12, 'F')
    }

    doc.setTextColor(50, 50, 50)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    doc.text(currentSlot, 25, y + 8)
    doc.text(value, 125, y + 8)

    doc.setDrawColor(220, 220, 220)
    doc.line(20, y + 12, 190, y + 12)

    y += 12
  })

  // FOOTER
  doc.setTextColor(120, 120, 120)
  doc.setFontSize(9)

  doc.text(
    'Generated by Sweety Glucose Tracker',
    pageWidth / 2,
    185,
    { align: 'center' }
  )

  doc.text(
    'Personal glucose tracking report',
    pageWidth / 2,
    192,
    { align: 'center' }
  )

  // DOWNLOAD
  doc.save(`Sweety_Daily_Report_${reportDate}.pdf`)
}

  // NAVIGATION
  function navigate(page) {
    setActivePage(page)

    if (page === 'daily' && !dailyReport) {
      fetchDailyReport(reportDate)
    }
  }

  // DASHBOARD
  if (isDashboard) {
    return (
      <div className="dashboard">
        <header className="dash-header">
          <div className="brand">🩺 Sweety</div>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </header>

        <div className="dashboard-layout">
          {/* SIDEBAR */}
          <aside className="sidebar">
            <h3 className="sidebar-title">Menu</h3>

            <button
              className={`nav-btn ${
                activePage === 'dashboard' ? 'active' : ''
              }`}
              onClick={() => navigate('dashboard')}
            >
              🏠 Dashboard
            </button>

            <button
              className={`nav-btn ${
                activePage === 'daily' ? 'active' : ''
              }`}
              onClick={() => navigate('daily')}
            >
              📅 Daily Report
            </button>

            <button
              className={`nav-btn ${
                activePage === 'history' ? 'active' : ''
              }`}
              onClick={() => navigate('history')}
            >
              📋 History
            </button>
          </aside>

          {/* MAIN CONTENT */}
          <main className="dash-content">
            {/* DASHBOARD PAGE */}
            {activePage === 'dashboard' && (
              <>
                <h1>Hello! 👋</h1>

                <p className="dash-subtitle">
                  Your health, your daily progress.
                </p>

                <div className="stats">
                  <div className="stat-card">
                    <span>🩸</span>
                    <p>Latest Glucose</p>
                    <h2>{latest}</h2>
                    {latest !== '--' && <small>mg/dL</small>}
                  </div>

                  <div className="stat-card">
                    <span>📊</span>
                    <p>Average Glucose</p>
                    <h2>{average}</h2>
                    {average !== '--' && <small>mg/dL</small>}
                  </div>

                  <div className="stat-card">
                    <span>📝</span>
                    <p>Total Readings</p>
                    <h2>{readings.length}</h2>
                  </div>
                </div>

                {/* ADD READING */}
                <section className="reading-section">
                  <h2>Add Glucose Reading</h2>

                  <form className="reading-form" onSubmit={addReading}>
                    <label>Reading Date</label>

                    <input
                      type="date"
                      value={readingDate}
                      onChange={(e) => setReadingDate(e.target.value)}
                      max={getToday()}
                    />

                    <label>Reading Slot</label>

                    <select
                      value={slot}
                      onChange={(e) => setSlot(e.target.value)}
                    >
                      {slots.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder="Enter glucose (mg/dL)"
                      value={glucose}
                      onChange={(e) => setGlucose(e.target.value)}
                      min="1"
                    />

                    <button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : '+ Add Reading'}
                    </button>
                  </form>

                  {readingMessage && (
                    <p className="message">{readingMessage}</p>
                  )}
                </section>

                {/* WEEKLY CHART */}
                <section className="chart-section">
                  <h2>📊 Weekly Glucose Trend</h2>

                  <p className="chart-subtitle">
                    Daily average glucose · mg/dL
                  </p>

                  <div className="weekly-chart">
                    {weeklyData.map((day, index) => (
                      <div className="chart-column" key={index}>
                        <span className="chart-value">
                          {day.average || ''}
                        </span>

                        <div className="bar-area">
                          <div
                            className={`chart-bar ${
                              day.average === 0 ? 'empty-bar' : ''
                            }`}
                            style={{
                              height:
                                day.average === 0
                                  ? '5px'
                                  : `${(day.average / maxWeeklyValue) * 100}%`,
                            }}
                          ></div>
                        </div>

                        <span className="chart-day">{day.label}</span>

                        <span className="chart-count">
                          {day.count > 0
                            ? `${day.count} reading(s)`
                            : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* DAILY REPORT PAGE */}
            {activePage === 'daily' && (
              <section className="report-section">
                <h2>📅 Daily Report</h2>

                <p className="chart-subtitle">
                  View your glucose readings for a selected date.
                </p>

                <label>Select Report Date</label>

                <input
                  type="date"
                  value={reportDate}
                  max={getToday()}
                  onChange={(e) => {
                    const selectedDate = e.target.value
                    setReportDate(selectedDate)
                    fetchDailyReport(selectedDate)
                  }}
                />

                {reportLoading && (
                  <p className="message">Loading daily report...</p>
                )}

                {reportMessage && (
                  <p className="message">{reportMessage}</p>
                )}

                {!reportLoading && dailyReport && (
                  <>
                    <div className="stats report-stats">
                      <div className="stat-card">
                        <span>📝</span>
                        <p>Total Readings</p>
                        <h2>{dailyReport.total_readings}</h2>
                      </div>

                      <div className="stat-card">
                        <span>📊</span>
                        <p>Daily Average</p>
                        <h2>{reportAverage}</h2>
                        {reportAverage !== '--' && (
                          <small>mg/dL</small>
                        )}
                      </div>

                      <div className="stat-card">
                        <span>⬇️</span>
                        <p>Minimum</p>
                        <h2>{reportMinimum}</h2>
                        {reportMinimum !== '--' && (
                          <small>mg/dL</small>
                        )}
                      </div>

                      <div className="stat-card">
                        <span>⬆️</span>
                        <p>Maximum</p>
                        <h2>{reportMaximum}</h2>
                        {reportMaximum !== '--' && (
                          <small>mg/dL</small>
                        )}
                      </div>
                    </div>

                    <h3>Reading Details</h3>
                    <button
  className="download-pdf-btn"
  onClick={downloadDailyReport}
>
  📄 Download Daily Report PDF
</button>

                    {reportReadings.length === 0 ? (
                      <p className="empty">
                        No readings found for this date.
                      </p>
                    ) : (
                      <div className="report-readings">
                        {slots.map((currentSlot) => {
                          const slotReading = reportReadings.find(
                            (item) => item.slot === currentSlot
                          )

                          return (
                            <div
                              className="reading-item"
                              key={currentSlot}
                            >
                              <div>
                                <strong>{currentSlot}</strong>

                                <p>
                                  {slotReading
                                    ? `${slotReading.glucose_value} mg/dL`
                                    : 'No reading recorded'}
                                </p>
                              </div>

                              <span>
                                {slotReading ? '🩸' : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* HISTORY PAGE */}
            {activePage === 'history' && (
              <section className="history-section">
                <h2>📋 Reading History</h2>

                <p className="chart-subtitle">
                  All your saved glucose readings.
                </p>

                {readings.length === 0 ? (
                  <p className="empty">
                    No readings yet. Add your first reading!
                  </p>
                ) : (
                  readings.map((reading) => (
                    <div className="reading-item" key={reading.id}>
                      <div>
                        <strong>
                          🩸 {reading.value} mg/dL
                        </strong>

                        <p>{reading.slot}</p>
                        <p>{reading.reading_date}</p>
                        <p>{reading.time}</p>
                      </div>

                      <button
                        className="delete-btn"
                        onClick={() => deleteReading(reading.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}

                {readingMessage && (
                  <p className="message">{readingMessage}</p>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    )
  }

  // LOGIN / SIGNUP
  return (
    <div className="app">
      <div className="login-container">
        <div className="logo">🩺</div>

        <h1>Sweety</h1>

        <p className="subtitle">
          Your personal blood glucose tracker
        </p>

        <h2>{isSignup ? 'Create Account' : 'Welcome Back!'}</h2>

        <p className="description">
          {isSignup
            ? 'Create your account to start tracking your glucose levels.'
            : 'Track your glucose levels and take care of your health.'}
        </p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <>
              <label>Full Name</label>

              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}

          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {isSignup && (
            <>
              <label>Confirm Password</label>

              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </>
          )}

          <button type="submit">
            {isSignup ? 'Create Account' : 'Login'}
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <p className="signup">
          {isSignup
            ? 'Already have an account? '
            : "Don't have an account? "}

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              switchPage()
            }}
          >
            {isSignup ? 'Login' : 'Sign up'}
          </a>
        </p>
      </div>
    </div>
  )
}

export default App