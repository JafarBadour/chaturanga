import React from 'react';
import ChessBoardExample from './components/ChessBoardExample';
import { SideBar } from "./components/SideBar";
import "./App.css";

function App() {
  return (
    <div className="layout">
      <aside>
        <SideBar />
      </aside>

      <div className="App">
        <ChessBoardExample />
      </div>
    </div>
  );
}

export default App;
