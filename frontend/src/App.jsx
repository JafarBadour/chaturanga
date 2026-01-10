import React from 'react';
import ChessBoardExample from './components/ChessBoardExample';
import './App.css';
import ChessGrid from './components/ChessGrid';

function App() {
  return (
    <div className="App">
      <ChessBoardExample />
      <ChessGrid/>
    </div>
  );
}

export default App;
