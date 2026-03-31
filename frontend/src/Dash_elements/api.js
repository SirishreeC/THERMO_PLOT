import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000/api';

export const fetchTemperatureTrends = (filters = {}) => {
  return axios.get(`${API_BASE}/temperature-trends`, { params: filters });
};

export const fetchHeatmaps = (filters = {}) => {
  return axios.get(`${API_BASE}/heatmaps`, { params: filters });
};

export const fetchComparisons = (filters = {}) => {
  return axios.get(`${API_BASE}/comparisons`, { params: filters });
};
