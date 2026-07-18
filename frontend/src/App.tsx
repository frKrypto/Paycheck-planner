import { Routes, Route, Link } from 'react-router-dom';

function Dashboard() {
  return <h2>Dashboard</h2>;
}

function Login() {
  return <h2>Login</h2>;
}

function Signup() {
  return <h2>Sign Up</h2>;
}

function Income() {
  return <h2>Income</h2>;
}

function Expenses() {
  return <h2>Expenses</h2>;
}

export default function App() {
  return (
    <div>
      <nav>
        <Link to="/">Dashboard</Link>
        {' | '}
        <Link to="/login">Login</Link>
        {' | '}
        <Link to="/signup">Sign Up</Link>
        {' | '}
        <Link to="/income">Income</Link>
        {' | '}
        <Link to="/expenses">Expenses</Link>
      </nav>
      <main>
        <h1>PayCheck Planner</h1>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/income" element={<Income />} />
          <Route path="/expenses" element={<Expenses />} />
        </Routes>
      </main>
    </div>
  );
}
