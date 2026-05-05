import { configureStore } from'@reduxjs/toolkit';
import mentorReducer from'./slices/mentorSlice';
import financeReducer from'./slices/financeSlice';
import adminReducer from'./slices/adminSlice';

export const store = configureStore({
 reducer: {
 mentor: mentorReducer,
 finance: financeReducer,
 admin: adminReducer,
 },
});
