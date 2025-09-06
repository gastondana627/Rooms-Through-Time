// In App.tsx
import React from 'react';
import RoomScanner from './components/RoomScanner'; // Adjust path if needed

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>ChronoCanvas</h1> // Or your chosen app name
      </header>
      <main>
        <RoomScanner />
      </main>
    </div>
  );
}

export default App;