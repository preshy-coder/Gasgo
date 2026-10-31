// All the app's routes (pages) in one place.
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppFrame, RequireAuth, TabLayout } from './components/Layout'
import Checkout from './pages/Checkout'
import Dealers from './pages/Dealers'
import DealerOrderDetail from './pages/dealer/DealerOrderDetail'
import DealerOrders from './pages/dealer/DealerOrders'
import DealerStock from './pages/dealer/DealerStock'
import Help from './pages/Help'
import Home from './pages/Home'
import Location from './pages/Location'
import Login from './pages/Login'
import OrderDetail from './pages/OrderDetail'
import Orders from './pages/Orders'
import Payment from './pages/Payment'
import Profile from './pages/Profile'
import Welcome from './pages/Welcome'

export default function App() {
  return (
    <Routes>
      <Route element={<AppFrame />}>
        {/* Public */}
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />

        {/* Customer */}
        <Route element={<RequireAuth role="customer" />}>
          <Route element={<TabLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/help" element={<Help />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/location" element={<Location />} />
          <Route path="/dealers" element={<Dealers />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/orders/:id/pay" element={<Payment />} />
        </Route>

        {/* Dealer */}
        <Route element={<RequireAuth role="dealer" />}>
          <Route path="/dealer" element={<DealerOrders />} />
          <Route path="/dealer/stock" element={<DealerStock />} />
          <Route path="/dealer/orders/:id" element={<DealerOrderDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
