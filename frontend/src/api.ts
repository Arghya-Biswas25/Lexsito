import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("lex_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const TOKEN_KEY = "lex_token";
export const USER_KEY = "lex_user";
