import React from 'react';
import { Navigate } from 'react-router-dom';
import { get_user_info } from '../Authorized/getRole';

const isAuthenticated = () => {
    const access = localStorage.getItem('access_token')
    return !!access;
};

const PrivateRoute = ({ children, allowed = [] }) => {
    const user_info = get_user_info();
    const isAuth = isAuthenticated();

    // Safety check: if authenticated but user_info is null (decoding error)
    if (isAuth && user_info) {
        if (allowed.includes(user_info.role)) {
            return children;
        }
        // If role not allowed, we don't necessarily redirect to login, 
        // maybe to a default dashboard, but '/' is safer for unauth access
    }

    // If not authenticated or decoding failed or role not allowed, redirect to login
    if (!isAuth || !user_info || !allowed.includes(user_info.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default PrivateRoute;