export default function TestDashboard() {
  console.log('🎉 TestDashboard is rendering!')

  return (
    <div style={{
      padding: '20px',
      background: '#00ff00',
      minHeight: '100vh',
      color: 'black',
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: 'black', fontSize: '36px', textAlign: 'center' }}>
        🎉 REACT IS WORKING! 🎉
      </h1>
      <div style={{
        border: '5px solid red',
        padding: '20px',
        margin: '20px 0',
        background: 'yellow',
        textAlign: 'center'
      }}>
        <h2 style={{ color: 'red', fontSize: '24px' }}>SUCCESS: COMPONENT LOADED</h2>
        <p style={{ color: 'black', fontSize: '18px' }}>
          If you see this bright green page, React is working!
        </p>
      </div>
    </div>
  )
}