export default function SimpleTest() {
  console.log('SimpleTest component is mounting!')

  if (typeof window !== 'undefined') {
    console.log('Window object exists')
    window.REACT_DEBUG = 'Simple test component loaded successfully'
  }

  return <h1 style={{color: 'red', fontSize: '48px'}}>SIMPLE TEST WORKING</h1>
}