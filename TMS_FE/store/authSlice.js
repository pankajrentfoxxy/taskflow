import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiGet, apiPost } from "@/lib/api";
export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await apiPost("/auth/login", credentials);
      return {
        user: data.user,
        tokens: data.tokens,
      };
    } catch (error) {
      return rejectWithValue(error.message || "Login failed");
    }
  },
);

export const verifySession = createAsyncThunk(
  "auth/verifySession",
  async (_, { getState, rejectWithValue }) => {
    const token = getState().auth.tokens?.accessToken;
    if (!token) return null;

    try {
      const data = await apiGet("/auth/me", { token });
      return data.user;
    } catch {
      return rejectWithValue("Session expired");
    }
  },
);

export const logout = createAsyncThunk("auth/logout", async (_, { getState }) => {
  const token = getState().auth.tokens?.accessToken;

  if (token) {
    try {
      await apiPost("/auth/logout", undefined, { token });
    } catch {
      // Clear local session even if API logout fails.
    }
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    tokens: null,
    initialized: false,
    status: "idle",
    error: null,
  },
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
    setAuthSession(state, action) {
      state.tokens = action.payload.tokens;
      if (action.payload.user !== undefined) {
        state.user = action.payload.user;
      }
    },
    clearAuthSession(state) {
      state.user = null;
      state.tokens = null;
      state.initialized = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "idle";
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.initialized = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "idle";
        state.error = action.payload;
      })
      .addCase(verifySession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        state.status = "idle";
        state.initialized = true;
        if (action.payload) {
          state.user = action.payload;
        }
      })
      .addCase(verifySession.rejected, (state) => {
        state.status = "idle";
        state.initialized = true;
        state.user = null;
        state.tokens = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.tokens = null;
        state.status = "idle";
        state.error = null;
        state.initialized = true;
      });
  },
});

export const { clearAuthError, setAuthSession, clearAuthSession } =
  authSlice.actions;
export default authSlice.reducer;
