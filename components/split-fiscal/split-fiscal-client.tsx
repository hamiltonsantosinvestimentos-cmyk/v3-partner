"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PieChart, Plus, Calculator, TrendingUp, Table2, Users, RotateCcw, FileDown } from "lucide-react";

// ─── Data from Excel: Monetto Split Planos e Rebatimentos Finance ─────────────

const MODALITIES = [
  "DÉBITO", "Crédito 1x", "Crédito 2x", "Crédito 3x", "Crédito 4x", "Crédito 5x",
  "Crédito 6x", "Crédito 7x", "Crédito 8x", "Crédito 9x", "Crédito 10x",
  "Crédito 11x", "Crédito 12x", "Crédito 13x", "Crédito 14x", "Crédito 15x",
  "Crédito 16x", "Crédito 17x", "Crédito 18x", "Crédito 19x", "Crédito 20x",
  "Crédito 21x", "PIX",
];

interface PlanData {
  name: string;
  taxa: Record<string, { visa: number | string; master: number | string; elo: number | string; amex: number | string }>;
  rebate: Record<string, { visa: number | string; master: number | string; elo: number | string; amex: number | string }>;
}

const PLANS: PlanData[] = [
  {
    name: "Plano 1",
    taxa: {
      "DÉBITO": { visa: 0.0199, master: 0.0199, elo: 0.023, amex: "-" },
      "Crédito 1x": { visa: 0.0399, master: 0.0399, elo: 0.0499, amex: 0.0499 },
      "Crédito 2x": { visa: 0.0586, master: 0.0586, elo: 0.0654, amex: 0.0654 },
      "Crédito 3x": { visa: 0.0681, master: 0.0681, elo: 0.0749, amex: 0.0749 },
      "Crédito 4x": { visa: 0.0777, master: 0.0777, elo: 0.0844, amex: 0.0844 },
      "Crédito 5x": { visa: 0.0872, master: 0.0872, elo: 0.0939, amex: 0.0939 },
      "Crédito 6x": { visa: 0.0968, master: 0.0968, elo: 0.1034, amex: 0.1034 },
      "Crédito 7x": { visa: 0.1110, master: 0.1110, elo: 0.1212, amex: 0.1212 },
      "Crédito 8x": { visa: 0.1205, master: 0.1205, elo: 0.1306, amex: 0.1306 },
      "Crédito 9x": { visa: 0.1300, master: 0.1300, elo: 0.1400, amex: 0.1400 },
      "Crédito 10x": { visa: 0.1395, master: 0.1395, elo: 0.1494, amex: 0.1494 },
      "Crédito 11x": { visa: 0.1490, master: 0.1490, elo: 0.1588, amex: 0.1588 },
      "Crédito 12x": { visa: 0.1585, master: 0.1585, elo: 0.1682, amex: 0.1682 },
      "Crédito 13x": { visa: 0.1688, master: 0.1688, elo: 0.1828, amex: 0.1828 },
      "Crédito 14x": { visa: 0.1791, master: 0.1791, elo: 0.1921, amex: 0.1921 },
      "Crédito 15x": { visa: 0.1894, master: 0.1894, elo: 0.2015, amex: 0.2015 },
      "Crédito 16x": { visa: 0.1997, master: 0.1997, elo: 0.2108, amex: 0.2108 },
      "Crédito 17x": { visa: 0.2099, master: 0.2099, elo: 0.2201, amex: 0.2201 },
      "Crédito 18x": { visa: 0.2199, master: 0.2199, elo: 0.2294, amex: 0.2294 },
      "Crédito 19x": { visa: 0.2302, master: 0.2302, elo: 0.2617, amex: 0.2394 },
      "Crédito 20x": { visa: 0.2405, master: 0.2405, elo: 0.2717, amex: 0.2494 },
      "Crédito 21x": { visa: 0.2499, master: 0.2499, elo: 0.2817, amex: 0.2594 },
      "PIX": { visa: 0.0199, master: "-", elo: "-", amex: "-" },
    },
    rebate: {
      "DÉBITO": { visa: 0.00138, master: 0.00138, elo: 0.0007, amex: "-" },
      "Crédito 1x": { visa: 0.00068, master: 0.00068, elo: 0.0017, amex: 0.0001 },
      "Crédito 2x": { visa: 0.00132, master: 0.00132, elo: 0.00092, amex: 0.00014 },
      "Crédito 3x": { visa: 0.00186, master: 0.00186, elo: 0.00144, amex: 0.0005 },
      "Crédito 4x": { visa: 0.00242, master: 0.00242, elo: 0.00208, amex: 0.00084 },
      "Crédito 5x": { visa: 0.00280, master: 0.00280, elo: 0.00244, amex: 0.0012 },
      "Crédito 6x": { visa: 0.00316, master: 0.00316, elo: 0.00278, amex: 0.00156 },
      "Crédito 7x": { visa: 0.00436, master: 0.00436, elo: 0.00472, amex: 0.0032 },
      "Crédito 8x": { visa: 0.00464, master: 0.00464, elo: 0.00494, amex: 0.00352 },
      "Crédito 9x": { visa: 0.00520, master: 0.00520, elo: 0.00520, amex: 0.00386 },
      "Crédito 10x": { visa: 0.00594, master: 0.00594, elo: 0.00542, amex: 0.0042 },
      "Crédito 11x": { visa: 0.00590, master: 0.00590, elo: 0.00618, amex: 0.00454 },
      "Crédito 12x": { visa: 0.00666, master: 0.00666, elo: 0.00640, amex: 0.00488 },
      "Crédito 13x": { visa: 0.00558, master: 0.00558, elo: 0.00696, amex: 0.00624 },
      "Crédito 14x": { visa: 0.00608, master: 0.00608, elo: 0.00726, amex: 0.00656 },
      "Crédito 15x": { visa: 0.00658, master: 0.00658, elo: 0.00760, amex: 0.0089 },
      "Crédito 16x": { visa: 0.00706, master: 0.00706, elo: 0.00790, amex: 0.00722 },
      "Crédito 17x": { visa: 0.00754, master: 0.00754, elo: 0.00822, amex: 0.00754 },
      "Crédito 18x": { visa: 0.00798, master: 0.00798, elo: 0.00852, amex: 0.00784 },
      "Crédito 19x": { visa: 0.00790, master: 0.00790, elo: 0.01344, amex: 0.00832 },
      "Crédito 20x": { visa: 0.00842, master: 0.00842, elo: 0.01468, amex: 0.00878 },
      "Crédito 21x": { visa: 0.00896, master: 0.00896, elo: 0.01514, amex: 0.00924 },
      "PIX": { visa: 0.0016, master: "-", elo: "-", amex: "-" },
    },
  },
  {
    name: "Plano 2",
    taxa: {
      "DÉBITO": { visa: 0.0249, master: 0.0249, elo: 0.028, amex: "-" },
      "Crédito 1x": { visa: 0.0449, master: 0.0449, elo: 0.0549, amex: 0.0549 },
      "Crédito 2x": { visa: 0.0636, master: 0.0636, elo: 0.0704, amex: 0.0704 },
      "Crédito 3x": { visa: 0.0731, master: 0.0731, elo: 0.0799, amex: 0.0799 },
      "Crédito 4x": { visa: 0.0827, master: 0.0827, elo: 0.0894, amex: 0.0894 },
      "Crédito 5x": { visa: 0.0922, master: 0.0922, elo: 0.0989, amex: 0.0989 },
      "Crédito 6x": { visa: 0.1018, master: 0.1018, elo: 0.1084, amex: 0.1084 },
      "Crédito 7x": { visa: 0.1160, master: 0.1160, elo: 0.1262, amex: 0.1262 },
      "Crédito 8x": { visa: 0.1255, master: 0.1255, elo: 0.1356, amex: 0.1356 },
      "Crédito 9x": { visa: 0.1350, master: 0.1350, elo: 0.1450, amex: 0.1450 },
      "Crédito 10x": { visa: 0.1445, master: 0.1445, elo: 0.1544, amex: 0.1544 },
      "Crédito 11x": { visa: 0.1540, master: 0.1540, elo: 0.1638, amex: 0.1638 },
      "Crédito 12x": { visa: 0.1635, master: 0.1635, elo: 0.1732, amex: 0.1732 },
      "Crédito 13x": { visa: 0.1738, master: 0.1738, elo: 0.1878, amex: 0.1878 },
      "Crédito 14x": { visa: 0.1841, master: 0.1841, elo: 0.1971, amex: 0.1971 },
      "Crédito 15x": { visa: 0.1944, master: 0.1944, elo: 0.2065, amex: 0.2065 },
      "Crédito 16x": { visa: 0.2047, master: 0.2047, elo: 0.2158, amex: 0.2158 },
      "Crédito 17x": { visa: 0.2149, master: 0.2149, elo: 0.2251, amex: 0.2251 },
      "Crédito 18x": { visa: 0.2249, master: 0.2249, elo: 0.2344, amex: 0.2344 },
      "Crédito 19x": { visa: 0.2352, master: 0.2352, elo: 0.2667, amex: 0.2444 },
      "Crédito 20x": { visa: 0.2455, master: 0.2455, elo: 0.2767, amex: 0.2544 },
      "Crédito 21x": { visa: 0.2549, master: 0.2549, elo: 0.2867, amex: 0.2644 },
      "PIX": { visa: 0.0249, master: "-", elo: "-", amex: "-" },
    },
    rebate: {
      "DÉBITO": { visa: 0.00238, master: 0.00238, elo: 0.0017, amex: "-" },
      "Crédito 1x": { visa: 0.00168, master: 0.00168, elo: 0.0027, amex: 0.0011 },
      "Crédito 2x": { visa: 0.00232, master: 0.00232, elo: 0.00192, amex: 0.00114 },
      "Crédito 3x": { visa: 0.00286, master: 0.00286, elo: 0.00244, amex: 0.0015 },
      "Crédito 4x": { visa: 0.00342, master: 0.00342, elo: 0.00308, amex: 0.00184 },
      "Crédito 5x": { visa: 0.00380, master: 0.00380, elo: 0.00344, amex: 0.0022 },
      "Crédito 6x": { visa: 0.00416, master: 0.00416, elo: 0.00378, amex: 0.00256 },
      "Crédito 7x": { visa: 0.00536, master: 0.00536, elo: 0.00572, amex: 0.0042 },
      "Crédito 8x": { visa: 0.00564, master: 0.00564, elo: 0.00594, amex: 0.00452 },
      "Crédito 9x": { visa: 0.00620, master: 0.00620, elo: 0.00620, amex: 0.00486 },
      "Crédito 10x": { visa: 0.00694, master: 0.00694, elo: 0.00642, amex: 0.0052 },
      "Crédito 11x": { visa: 0.00690, master: 0.00690, elo: 0.00718, amex: 0.00554 },
      "Crédito 12x": { visa: 0.00766, master: 0.00766, elo: 0.00740, amex: 0.00588 },
      "Crédito 13x": { visa: 0.00658, master: 0.00658, elo: 0.00796, amex: 0.00724 },
      "Crédito 14x": { visa: 0.00708, master: 0.00708, elo: 0.00826, amex: 0.00756 },
      "Crédito 15x": { visa: 0.00758, master: 0.00758, elo: 0.00860, amex: 0.0099 },
      "Crédito 16x": { visa: 0.00806, master: 0.00806, elo: 0.00890, amex: 0.00822 },
      "Crédito 17x": { visa: 0.00854, master: 0.00854, elo: 0.00922, amex: 0.00854 },
      "Crédito 18x": { visa: 0.00898, master: 0.00898, elo: 0.00952, amex: 0.00884 },
      "Crédito 19x": { visa: 0.00890, master: 0.00890, elo: 0.01444, amex: 0.00932 },
      "Crédito 20x": { visa: 0.00942, master: 0.00942, elo: 0.01568, amex: 0.00978 },
      "Crédito 21x": { visa: 0.00996, master: 0.00996, elo: 0.01614, amex: 0.01024 },
      "PIX": { visa: 0.0026, master: "-", elo: "-", amex: "-" },
    },
  },
  {
    name: "Plano 3",
    taxa: {
      "DÉBITO": { visa: 0.0299, master: 0.0299, elo: 0.033, amex: "-" },
      "Crédito 1x": { visa: 0.0499, master: 0.0499, elo: 0.0599, amex: 0.0599 },
      "Crédito 2x": { visa: 0.0686, master: 0.0686, elo: 0.0754, amex: 0.0754 },
      "Crédito 3x": { visa: 0.0781, master: 0.0781, elo: 0.0849, amex: 0.0849 },
      "Crédito 4x": { visa: 0.0877, master: 0.0877, elo: 0.0944, amex: 0.0944 },
      "Crédito 5x": { visa: 0.0972, master: 0.0972, elo: 0.1039, amex: 0.1039 },
      "Crédito 6x": { visa: 0.1068, master: 0.1068, elo: 0.1134, amex: 0.1134 },
      "Crédito 7x": { visa: 0.1210, master: 0.1210, elo: 0.1312, amex: 0.1312 },
      "Crédito 8x": { visa: 0.1305, master: 0.1305, elo: 0.1406, amex: 0.1406 },
      "Crédito 9x": { visa: 0.1400, master: 0.1400, elo: 0.1500, amex: 0.1500 },
      "Crédito 10x": { visa: 0.1495, master: 0.1495, elo: 0.1594, amex: 0.1594 },
      "Crédito 11x": { visa: 0.1590, master: 0.1590, elo: 0.1688, amex: 0.1688 },
      "Crédito 12x": { visa: 0.1685, master: 0.1685, elo: 0.1782, amex: 0.1782 },
      "Crédito 13x": { visa: 0.1788, master: 0.1788, elo: 0.1928, amex: 0.1928 },
      "Crédito 14x": { visa: 0.1891, master: 0.1891, elo: 0.2021, amex: 0.2021 },
      "Crédito 15x": { visa: 0.1994, master: 0.1994, elo: 0.2115, amex: 0.2115 },
      "Crédito 16x": { visa: 0.2097, master: 0.2097, elo: 0.2208, amex: 0.2208 },
      "Crédito 17x": { visa: 0.2199, master: 0.2199, elo: 0.2301, amex: 0.2301 },
      "Crédito 18x": { visa: 0.2299, master: 0.2299, elo: 0.2394, amex: 0.2394 },
      "Crédito 19x": { visa: 0.2402, master: 0.2402, elo: 0.2717, amex: 0.2494 },
      "Crédito 20x": { visa: 0.2505, master: 0.2505, elo: 0.2817, amex: 0.2594 },
      "Crédito 21x": { visa: 0.2599, master: 0.2599, elo: 0.2917, amex: 0.2694 },
      "PIX": { visa: 0.0299, master: "-", elo: "-", amex: "-" },
    },
    rebate: {
      "DÉBITO": { visa: 0.00338, master: 0.00338, elo: 0.0027, amex: "-" },
      "Crédito 1x": { visa: 0.00268, master: 0.00268, elo: 0.0037, amex: 0.0021 },
      "Crédito 2x": { visa: 0.00332, master: 0.00332, elo: 0.00292, amex: 0.00214 },
      "Crédito 3x": { visa: 0.00386, master: 0.00386, elo: 0.00344, amex: 0.0025 },
      "Crédito 4x": { visa: 0.00442, master: 0.00442, elo: 0.00408, amex: 0.00284 },
      "Crédito 5x": { visa: 0.00480, master: 0.00480, elo: 0.00444, amex: 0.0032 },
      "Crédito 6x": { visa: 0.00516, master: 0.00516, elo: 0.00478, amex: 0.00356 },
      "Crédito 7x": { visa: 0.00636, master: 0.00636, elo: 0.00672, amex: 0.0052 },
      "Crédito 8x": { visa: 0.00664, master: 0.00664, elo: 0.00694, amex: 0.00552 },
      "Crédito 9x": { visa: 0.00720, master: 0.00720, elo: 0.00720, amex: 0.00586 },
      "Crédito 10x": { visa: 0.00794, master: 0.00794, elo: 0.00742, amex: 0.0062 },
      "Crédito 11x": { visa: 0.00790, master: 0.00790, elo: 0.00818, amex: 0.00654 },
      "Crédito 12x": { visa: 0.00866, master: 0.00866, elo: 0.00840, amex: 0.00688 },
      "Crédito 13x": { visa: 0.00758, master: 0.00758, elo: 0.00896, amex: 0.00824 },
      "Crédito 14x": { visa: 0.00808, master: 0.00808, elo: 0.00926, amex: 0.00856 },
      "Crédito 15x": { visa: 0.00858, master: 0.00858, elo: 0.00960, amex: 0.0109 },
      "Crédito 16x": { visa: 0.00906, master: 0.00906, elo: 0.00990, amex: 0.00922 },
      "Crédito 17x": { visa: 0.00954, master: 0.00954, elo: 0.01022, amex: 0.00954 },
      "Crédito 18x": { visa: 0.00998, master: 0.00998, elo: 0.01052, amex: 0.00984 },
      "Crédito 19x": { visa: 0.00990, master: 0.00990, elo: 0.01544, amex: 0.01032 },
      "Crédito 20x": { visa: 0.01042, master: 0.01042, elo: 0.01668, amex: 0.01078 },
      "Crédito 21x": { visa: 0.01096, master: 0.01096, elo: 0.01714, amex: 0.01124 },
      "PIX": { visa: 0.0036, master: "-", elo: "-", amex: "-" },
    },
  },
  {
    name: "Plano 4",
    taxa: {
      "DÉBITO": { visa: 0.0349, master: 0.0349, elo: 0.038, amex: "-" },
      "Crédito 1x": { visa: 0.0499, master: 0.0499, elo: 0.0599, amex: 0.0599 },
      "Crédito 2x": { visa: 0.0686, master: 0.0686, elo: 0.0754, amex: 0.0754 },
      "Crédito 3x": { visa: 0.0781, master: 0.0781, elo: 0.0849, amex: 0.0849 },
      "Crédito 4x": { visa: 0.0877, master: 0.0877, elo: 0.0944, amex: 0.0944 },
      "Crédito 5x": { visa: 0.0972, master: 0.0972, elo: 0.1039, amex: 0.1039 },
      "Crédito 6x": { visa: 0.1068, master: 0.1068, elo: 0.1134, amex: 0.1134 },
      "Crédito 7x": { visa: 0.1210, master: 0.1210, elo: 0.1312, amex: 0.1312 },
      "Crédito 8x": { visa: 0.1305, master: 0.1305, elo: 0.1406, amex: 0.1406 },
      "Crédito 9x": { visa: 0.1400, master: 0.1400, elo: 0.1500, amex: 0.1500 },
      "Crédito 10x": { visa: 0.1495, master: 0.1495, elo: 0.1594, amex: 0.1594 },
      "Crédito 11x": { visa: 0.1590, master: 0.1590, elo: 0.1688, amex: 0.1688 },
      "Crédito 12x": { visa: 0.1685, master: 0.1685, elo: 0.1782, amex: 0.1782 },
      "Crédito 13x": { visa: 0.1788, master: 0.1788, elo: 0.1928, amex: 0.1928 },
      "Crédito 14x": { visa: 0.1891, master: 0.1891, elo: 0.2021, amex: 0.2021 },
      "Crédito 15x": { visa: 0.1994, master: 0.1994, elo: 0.2115, amex: 0.2115 },
      "Crédito 16x": { visa: 0.2097, master: 0.2097, elo: 0.2208, amex: 0.2208 },
      "Crédito 17x": { visa: 0.2199, master: 0.2199, elo: 0.2301, amex: 0.2301 },
      "Crédito 18x": { visa: 0.2299, master: 0.2299, elo: 0.2394, amex: 0.2394 },
      "Crédito 19x": { visa: 0.2402, master: 0.2402, elo: 0.2717, amex: 0.2494 },
      "Crédito 20x": { visa: 0.2505, master: 0.2505, elo: 0.2817, amex: 0.2594 },
      "Crédito 21x": { visa: 0.2599, master: 0.2599, elo: 0.2917, amex: 0.2694 },
      "PIX": { visa: 0.0349, master: "-", elo: "-", amex: "-" },
    },
    rebate: {
      "DÉBITO": { visa: 0.00438, master: 0.00438, elo: 0.0037, amex: "-" },
      "Crédito 1x": { visa: 0.00268, master: 0.00268, elo: 0.0037, amex: 0.0021 },
      "Crédito 2x": { visa: 0.00332, master: 0.00332, elo: 0.00292, amex: 0.00214 },
      "Crédito 3x": { visa: 0.00386, master: 0.00386, elo: 0.00344, amex: 0.0025 },
      "Crédito 4x": { visa: 0.00442, master: 0.00442, elo: 0.00408, amex: 0.00284 },
      "Crédito 5x": { visa: 0.00480, master: 0.00480, elo: 0.00444, amex: 0.0032 },
      "Crédito 6x": { visa: 0.00516, master: 0.00516, elo: 0.00478, amex: 0.00356 },
      "Crédito 7x": { visa: 0.00636, master: 0.00636, elo: 0.00672, amex: 0.0052 },
      "Crédito 8x": { visa: 0.00664, master: 0.00664, elo: 0.00694, amex: 0.00552 },
      "Crédito 9x": { visa: 0.00720, master: 0.00720, elo: 0.00720, amex: 0.00586 },
      "Crédito 10x": { visa: 0.00794, master: 0.00794, elo: 0.00742, amex: 0.0062 },
      "Crédito 11x": { visa: 0.00790, master: 0.00790, elo: 0.00818, amex: 0.00654 },
      "Crédito 12x": { visa: 0.00866, master: 0.00866, elo: 0.00840, amex: 0.00688 },
      "Crédito 13x": { visa: 0.00758, master: 0.00758, elo: 0.00896, amex: 0.00824 },
      "Crédito 14x": { visa: 0.00808, master: 0.00808, elo: 0.00926, amex: 0.00856 },
      "Crédito 15x": { visa: 0.00858, master: 0.00858, elo: 0.00960, amex: 0.0109 },
      "Crédito 16x": { visa: 0.00906, master: 0.00906, elo: 0.00990, amex: 0.00922 },
      "Crédito 17x": { visa: 0.00954, master: 0.00954, elo: 0.01022, amex: 0.00954 },
      "Crédito 18x": { visa: 0.00998, master: 0.00998, elo: 0.01052, amex: 0.00984 },
      "Crédito 19x": { visa: 0.00990, master: 0.00990, elo: 0.01544, amex: 0.01032 },
      "Crédito 20x": { visa: 0.01042, master: 0.01042, elo: 0.01668, amex: 0.01078 },
      "Crédito 21x": { visa: 0.01096, master: 0.01096, elo: 0.01714, amex: 0.01124 },
      "PIX": { visa: 0.0046, master: "-", elo: "-", amex: "-" },
    },
  },
  {
    name: "Plano 5",
    taxa: {
      "DÉBITO": { visa: 0.0299, master: 0.0299, elo: 0.033, amex: "-" },
      "Crédito 1x": { visa: 0.0599, master: 0.0599, elo: 0.0646, amex: 0.0646 },
      "Crédito 2x": { visa: 0.0816, master: 0.0816, elo: 0.0884, amex: 0.0884 },
      "Crédito 3x": { visa: 0.0911, master: 0.0911, elo: 0.0979, amex: 0.0979 },
      "Crédito 4x": { visa: 0.1007, master: 0.1007, elo: 0.1074, amex: 0.1074 },
      "Crédito 5x": { visa: 0.1102, master: 0.1102, elo: 0.1169, amex: 0.1169 },
      "Crédito 6x": { visa: 0.1198, master: 0.1198, elo: 0.1264, amex: 0.1264 },
      "Crédito 7x": { visa: 0.1340, master: 0.1340, elo: 0.1442, amex: 0.1442 },
      "Crédito 8x": { visa: 0.1435, master: 0.1435, elo: 0.1536, amex: 0.1536 },
      "Crédito 9x": { visa: 0.1530, master: 0.1530, elo: 0.1630, amex: 0.1630 },
      "Crédito 10x": { visa: 0.1625, master: 0.1625, elo: 0.1724, amex: 0.1724 },
      "Crédito 11x": { visa: 0.1720, master: 0.1720, elo: 0.1818, amex: 0.1818 },
      "Crédito 12x": { visa: 0.1815, master: 0.1815, elo: 0.1912, amex: 0.1912 },
      "Crédito 13x": { visa: 0.1888, master: 0.1888, elo: 0.2028, amex: 0.2028 },
      "Crédito 14x": { visa: 0.1991, master: 0.1991, elo: 0.2121, amex: 0.2121 },
      "Crédito 15x": { visa: 0.2094, master: 0.2094, elo: 0.2215, amex: 0.2215 },
      "Crédito 16x": { visa: 0.2197, master: 0.2197, elo: 0.2308, amex: 0.2308 },
      "Crédito 17x": { visa: 0.2299, master: 0.2299, elo: 0.2401, amex: 0.2401 },
      "Crédito 18x": { visa: 0.2399, master: 0.2399, elo: 0.2494, amex: 0.2494 },
      "Crédito 19x": { visa: 0.2502, master: 0.2502, elo: 0.2817, amex: 0.2594 },
      "Crédito 20x": { visa: 0.2605, master: 0.2605, elo: 0.2917, amex: 0.2694 },
      "Crédito 21x": { visa: 0.2699, master: 0.2699, elo: 0.3017, amex: 0.2794 },
      "PIX": { visa: 0.0299, master: "-", elo: "-", amex: "-" },
    },
    rebate: {
      "DÉBITO": { visa: 0.00338, master: 0.00338, elo: 0.0027, amex: "-" },
      "Crédito 1x": { visa: 0.00468, master: 0.00468, elo: 0.00464, amex: 0.00304 },
      "Crédito 2x": { visa: 0.00592, master: 0.00592, elo: 0.00552, amex: 0.00474 },
      "Crédito 3x": { visa: 0.00646, master: 0.00646, elo: 0.00604, amex: 0.0051 },
      "Crédito 4x": { visa: 0.00702, master: 0.00702, elo: 0.00668, amex: 0.00544 },
      "Crédito 5x": { visa: 0.00740, master: 0.00740, elo: 0.00704, amex: 0.0058 },
      "Crédito 6x": { visa: 0.00776, master: 0.00776, elo: 0.00738, amex: 0.00616 },
      "Crédito 7x": { visa: 0.00896, master: 0.00896, elo: 0.00932, amex: 0.0078 },
      "Crédito 8x": { visa: 0.00924, master: 0.00924, elo: 0.00954, amex: 0.00812 },
      "Crédito 9x": { visa: 0.00980, master: 0.00980, elo: 0.00980, amex: 0.00846 },
      "Crédito 10x": { visa: 0.01054, master: 0.01054, elo: 0.01002, amex: 0.0088 },
      "Crédito 11x": { visa: 0.01050, master: 0.01050, elo: 0.01078, amex: 0.00914 },
      "Crédito 12x": { visa: 0.01126, master: 0.01126, elo: 0.01100, amex: 0.00948 },
      "Crédito 13x": { visa: 0.00958, master: 0.00958, elo: 0.01096, amex: 0.01024 },
      "Crédito 14x": { visa: 0.01008, master: 0.01008, elo: 0.01126, amex: 0.01056 },
      "Crédito 15x": { visa: 0.01058, master: 0.01058, elo: 0.01160, amex: 0.0129 },
      "Crédito 16x": { visa: 0.01106, master: 0.01106, elo: 0.01190, amex: 0.01122 },
      "Crédito 17x": { visa: 0.01154, master: 0.01154, elo: 0.01222, amex: 0.01154 },
      "Crédito 18x": { visa: 0.01198, master: 0.01198, elo: 0.01252, amex: 0.01184 },
      "Crédito 19x": { visa: 0.01190, master: 0.01190, elo: 0.01744, amex: 0.01232 },
      "Crédito 20x": { visa: 0.01242, master: 0.01242, elo: 0.01868, amex: 0.01278 },
      "Crédito 21x": { visa: 0.01296, master: 0.01296, elo: 0.01914, amex: 0.01324 },
      "PIX": { visa: 0.0036, master: "-", elo: "-", amex: "-" },
    },
  },
  {
    name: "Plano 6",
    taxa: {
      "DÉBITO": { visa: 0.0399, master: 0.0399, elo: 0.043, amex: "-" },
      "Crédito 1x": { visa: 0.0599, master: 0.0599, elo: 0.0646, amex: 0.0646 },
      "Crédito 2x": { visa: 0.0816, master: 0.0816, elo: 0.0884, amex: 0.0884 },
      "Crédito 3x": { visa: 0.0911, master: 0.0911, elo: 0.0979, amex: 0.0979 },
      "Crédito 4x": { visa: 0.1007, master: 0.1007, elo: 0.1074, amex: 0.1074 },
      "Crédito 5x": { visa: 0.1102, master: 0.1102, elo: 0.1169, amex: 0.1169 },
      "Crédito 6x": { visa: 0.1198, master: 0.1198, elo: 0.1264, amex: 0.1264 },
      "Crédito 7x": { visa: 0.1340, master: 0.1340, elo: 0.1442, amex: 0.1442 },
      "Crédito 8x": { visa: 0.1435, master: 0.1435, elo: 0.1536, amex: 0.1536 },
      "Crédito 9x": { visa: 0.1530, master: 0.1530, elo: 0.1630, amex: 0.1630 },
      "Crédito 10x": { visa: 0.1625, master: 0.1625, elo: 0.1724, amex: 0.1724 },
      "Crédito 11x": { visa: 0.1720, master: 0.1720, elo: 0.1818, amex: 0.1818 },
      "Crédito 12x": { visa: 0.1815, master: 0.1815, elo: 0.1912, amex: 0.1912 },
      "Crédito 13x": { visa: 0.1888, master: 0.1888, elo: 0.2028, amex: 0.2028 },
      "Crédito 14x": { visa: 0.1991, master: 0.1991, elo: 0.2121, amex: 0.2121 },
      "Crédito 15x": { visa: 0.2094, master: 0.2094, elo: 0.2215, amex: 0.2215 },
      "Crédito 16x": { visa: 0.2197, master: 0.2197, elo: 0.2308, amex: 0.2308 },
      "Crédito 17x": { visa: 0.2299, master: 0.2299, elo: 0.2401, amex: 0.2401 },
      "Crédito 18x": { visa: 0.2399, master: 0.2399, elo: 0.2494, amex: 0.2494 },
      "Crédito 19x": { visa: 0.2502, master: 0.2502, elo: 0.2817, amex: 0.2594 },
      "Crédito 20x": { visa: 0.2605, master: 0.2605, elo: 0.2917, amex: 0.2694 },
      "Crédito 21x": { visa: 0.2699, master: 0.2699, elo: 0.3017, amex: 0.2794 },
      "PIX": { visa: 0.0399, master: "-", elo: "-", amex: "-" },
    },
    rebate: {
      "DÉBITO": { visa: 0.00538, master: 0.00538, elo: 0.0047, amex: "-" },
      "Crédito 1x": { visa: 0.00468, master: 0.00468, elo: 0.00464, amex: 0.00304 },
      "Crédito 2x": { visa: 0.00592, master: 0.00592, elo: 0.00552, amex: 0.00474 },
      "Crédito 3x": { visa: 0.00646, master: 0.00646, elo: 0.00604, amex: 0.0051 },
      "Crédito 4x": { visa: 0.00702, master: 0.00702, elo: 0.00668, amex: 0.00544 },
      "Crédito 5x": { visa: 0.00740, master: 0.00740, elo: 0.00704, amex: 0.0058 },
      "Crédito 6x": { visa: 0.00776, master: 0.00776, elo: 0.00738, amex: 0.00616 },
      "Crédito 7x": { visa: 0.00896, master: 0.00896, elo: 0.00932, amex: 0.0078 },
      "Crédito 8x": { visa: 0.00924, master: 0.00924, elo: 0.00954, amex: 0.00812 },
      "Crédito 9x": { visa: 0.00980, master: 0.00980, elo: 0.00980, amex: 0.00846 },
      "Crédito 10x": { visa: 0.01054, master: 0.01054, elo: 0.01002, amex: 0.0088 },
      "Crédito 11x": { visa: 0.01050, master: 0.01050, elo: 0.01078, amex: 0.00914 },
      "Crédito 12x": { visa: 0.01126, master: 0.01126, elo: 0.01100, amex: 0.00948 },
      "Crédito 13x": { visa: 0.00958, master: 0.00958, elo: 0.01096, amex: 0.01024 },
      "Crédito 14x": { visa: 0.01008, master: 0.01008, elo: 0.01126, amex: 0.01056 },
      "Crédito 15x": { visa: 0.01058, master: 0.01058, elo: 0.01160, amex: 0.0129 },
      "Crédito 16x": { visa: 0.01106, master: 0.01106, elo: 0.01190, amex: 0.01122 },
      "Crédito 17x": { visa: 0.01154, master: 0.01154, elo: 0.01222, amex: 0.01154 },
      "Crédito 18x": { visa: 0.01198, master: 0.01198, elo: 0.01252, amex: 0.01184 },
      "Crédito 19x": { visa: 0.01190, master: 0.01190, elo: 0.01744, amex: 0.01232 },
      "Crédito 20x": { visa: 0.01242, master: 0.01242, elo: 0.01868, amex: 0.01278 },
      "Crédito 21x": { visa: 0.01296, master: 0.01296, elo: 0.01914, amex: 0.01324 },
      "PIX": { visa: 0.0056, master: "-", elo: "-", amex: "-" },
    },
  },
  {
    name: "Plano 7",
    taxa: {
      "DÉBITO": { visa: 0.0299, master: 0.0299, elo: 0.0319, amex: "-" },
      "Crédito 1x": { visa: 0.0599, master: 0.0599, elo: 0.0646, amex: 0.0646 },
      "Crédito 2x": { visa: 0.0802, master: 0.0802, elo: 0.0868, amex: 0.0868 },
      "Crédito 3x": { visa: 0.0947, master: 0.0947, elo: 0.1012, amex: 0.1012 },
      "Crédito 4x": { visa: 0.1091, master: 0.1091, elo: 0.1155, amex: 0.1155 },
      "Crédito 5x": { visa: 0.1236, master: 0.1236, elo: 0.1299, amex: 0.1299 },
      "Crédito 6x": { visa: 0.1380, master: 0.1380, elo: 0.1442, amex: 0.1442 },
      "Crédito 7x": { visa: 0.1561, master: 0.1561, elo: 0.1635, amex: 0.1635 },
      "Crédito 8x": { visa: 0.1705, master: 0.1705, elo: 0.1777, amex: 0.1777 },
      "Crédito 9x": { visa: 0.1849, master: 0.1849, elo: 0.1920, amex: 0.1920 },
      "Crédito 10x": { visa: 0.1992, master: 0.1992, elo: 0.2062, amex: 0.2062 },
      "Crédito 11x": { visa: 0.2136, master: 0.2136, elo: 0.2205, amex: 0.2205 },
      "Crédito 12x": { visa: 0.2280, master: 0.2280, elo: 0.2348, amex: 0.2348 },
      "Crédito 13x": { visa: 0.2524, master: 0.2524, elo: 0.2588, amex: 0.2588 },
      "Crédito 14x": { visa: 0.2666, master: 0.2666, elo: 0.2728, amex: 0.2728 },
      "Crédito 15x": { visa: 0.2808, master: 0.2808, elo: 0.2869, amex: 0.2869 },
      "Crédito 16x": { visa: 0.2950, master: 0.2950, elo: 0.3009, amex: 0.3009 },
      "Crédito 17x": { visa: 0.3091, master: 0.3091, elo: 0.3150, amex: 0.3150 },
      "Crédito 18x": { visa: 0.3233, master: 0.3233, elo: 0.3290, amex: 0.3290 },
      "Crédito 19x": { visa: 0.3375, master: 0.3375, elo: 0.3432, amex: 0.3432 },
      "Crédito 20x": { visa: 0.3517, master: 0.3517, elo: 0.3574, amex: 0.3574 },
      "Crédito 21x": { visa: 0.3659, master: 0.3659, elo: 0.3716, amex: 0.3716 },
      "PIX": { visa: 0.0299, master: "-", elo: "-", amex: "-" },
    },
    rebate: {
      "DÉBITO": { visa: 0.00338, master: 0.00338, elo: 0.00248, amex: "-" },
      "Crédito 1x": { visa: 0.00468, master: 0.00468, elo: 0.00464, amex: 0.00304 },
      "Crédito 2x": { visa: 0.00564, master: 0.00564, elo: 0.00520, amex: 0.00442 },
      "Crédito 3x": { visa: 0.00718, master: 0.00718, elo: 0.00670, amex: 0.00576 },
      "Crédito 4x": { visa: 0.00870, master: 0.00870, elo: 0.00830, amex: 0.00706 },
      "Crédito 5x": { visa: 0.01008, master: 0.01008, elo: 0.00964, amex: 0.0084 },
      "Crédito 6x": { visa: 0.01140, master: 0.01140, elo: 0.01094, amex: 0.00972 },
      "Crédito 7x": { visa: 0.01338, master: 0.01338, elo: 0.01318, amex: 0.01166 },
      "Crédito 8x": { visa: 0.01464, master: 0.01464, elo: 0.01436, amex: 0.01294 },
      "Crédito 9x": { visa: 0.01618, master: 0.01618, elo: 0.01560, amex: 0.01426 },
      "Crédito 10x": { visa: 0.01788, master: 0.01788, elo: 0.01678, amex: 0.01556 },
      "Crédito 11x": { visa: 0.01882, master: 0.01882, elo: 0.01852, amex: 0.01688 },
      "Crédito 12x": { visa: 0.02056, master: 0.02056, elo: 0.01972, amex: 0.0182 },
      "Crédito 13x": { visa: 0.02230, master: 0.02230, elo: 0.02216, amex: 0.02144 },
      "Crédito 14x": { visa: 0.02358, master: 0.02358, elo: 0.02340, amex: 0.02270 },
      "Crédito 15x": { visa: 0.02486, master: 0.02486, elo: 0.02468, amex: 0.02598 },
      "Crédito 16x": { visa: 0.02612, master: 0.02612, elo: 0.02592, amex: 0.02524 },
      "Crédito 17x": { visa: 0.02738, master: 0.02738, elo: 0.02720, amex: 0.02652 },
      "Crédito 18x": { visa: 0.02866, master: 0.02866, elo: 0.02844, amex: 0.02776 },
      "Crédito 19x": { visa: 0.02936, master: 0.02936, elo: 0.02974, amex: 0.02908 },
      "Crédito 20x": { visa: 0.03066, master: 0.03066, elo: 0.03182, amex: 0.03038 },
      "Crédito 21x": { visa: 0.03216, master: 0.03216, elo: 0.03312, amex: 0.03168 },
      "PIX": { visa: 0.0036, master: "-", elo: "-", amex: "-" },
    },
  },
];

// Comissão groups (averages from Excel COMISSÃO tab) for Plano 3
// Used to pre-calculate average rebate rates per group for any plan
function calcGroupAvg(plan: PlanData, keys: string[]): number {
  const rates = keys.map((k) => {
    const r = plan.rebate[k]?.visa;
    return typeof r === "number" ? r : 0;
  });
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

const COMM_GROUPS = [
  { label: "PIX", keys: ["PIX"] },
  { label: "Débito", keys: ["DÉBITO"] },
  { label: "Crédito à Vista (1x)", keys: ["Crédito 1x"] },
  { label: "Crédito Parcelado Média 2x a 6x", keys: ["Crédito 2x", "Crédito 3x", "Crédito 4x", "Crédito 5x", "Crédito 6x"] },
  { label: "Crédito Parcelado Média 7x a 12x", keys: ["Crédito 7x", "Crédito 8x", "Crédito 9x", "Crédito 10x", "Crédito 11x", "Crédito 12x"] },
  { label: "Crédito Parcelado Média 13x a 17x", keys: ["Crédito 13x", "Crédito 14x", "Crédito 15x", "Crédito 16x", "Crédito 17x"] },
  { label: "Crédito Parcelado Média 18x a 21x", keys: ["Crédito 18x", "Crédito 19x", "Crédito 20x", "Crédito 21x"] },
];

// ─── Helper ────────────────────────────────────────────────────────────────────
function pct(v: number | string) {
  if (typeof v === "string") return "-";
  return (v * 100).toFixed(4).replace(".", ",") + "%";
}

function n(v: string) {
  const s = v.replace(/\./g, "").replace(",", ".");
  const x = parseFloat(s);
  return isNaN(x) ? 0 : x;
}
// Para taxas e percentuais (ex: "2.99" = 2,99%) — NÃO remove o ponto decimal
function r(v: string): number {
  const s = v.replace(",", ".");
  const x = parseFloat(s);
  return isNaN(x) ? 0 : x;
}

interface SplitItem {
  id: string; code: string; title: string;
  total_value: number; split_percent: number | null;
  partner_revenue: number | null; status: string; created_at: string;
}

interface Lead {
  id: string;
  razao_social: string;
  cnpj: string;
  tpv: number;
  economiaMensal: number;
  economiaAnual: number;
  created_at: string;
}

interface SplitFiscalClientProps {
  list: SplitItem[];
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function SplitFiscalClient({ list }: SplitFiscalClientProps) {
  const [tab, setTab] = useState<"leads" | "rebate" | "comissao" | "proposta">("leads");
  const [selectedPlan, setSelectedPlan] = useState(2); // Plano 3 (index 2)
  const [leads, setLeads] = useState<Lead[]>([]);

  const totalValue = list.reduce((s, sp) => s + sp.total_value, 0);
  const totalRevenue = list.reduce((s, sp) => s + (sp.partner_revenue ?? 0), 0);

  const tabs = [
    { id: "leads", label: "Leads", icon: Users },
    { id: "rebate", label: "Tabela de Rebate", icon: Table2 },
    { id: "comissao", label: "Simulador de Comissão", icon: Calculator },
    { id: "proposta", label: "Simulador de Proposta", icon: TrendingUp },
  ] as const;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <PieChart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Split Fiscal — Monetto</h1>
            <p className="text-xs text-muted-foreground">Planos, Rebatimentos e Simuladores</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setTab("proposta")}><Plus className="w-4 h-4 mr-1.5" />Nova Simulação</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Leads", value: leads.length, color: "text-emerald-400" },
          { label: "Volume Total", value: formatCurrency(totalValue), color: "text-white" },
          { label: "Receita Partner", value: formatCurrency(totalRevenue), color: "text-amber-400" },
          { label: "Operações Aprovadas", value: list.filter((s) => s.status === "APPROVED").length, color: "text-emerald-400" },
        ].map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#091221] border border-[#122036]/80 rounded-xl p-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              tab === id
                ? "bg-[#C9A84C]/15 text-[#E8C97A] border border-[#C9A84C]/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "leads" && <LeadsTab leads={leads} setLeads={setLeads} onNewSimulacao={() => setTab("proposta")} />}
      {tab === "rebate" && <RebateTab selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />}
      {tab === "comissao" && <ComissaoTab selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />}
      {tab === "proposta" && <PropostaTab onAddLead={(lead) => { setLeads((prev) => [lead, ...prev]); setTab("leads"); }} />}
    </div>
  );
}

// ─── Tab: Leads ────────────────────────────────────────────────────────────────
function LeadsTab({
  leads,
  setLeads,
  onNewSimulacao,
}: {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  onNewSimulacao: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Leads — Prospecção Monetto</CardTitle>
          <Button size="sm" onClick={onNewSimulacao}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova Simulação
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Nenhum lead ainda</p>
              <p className="text-xs text-muted-foreground/60">Gere uma proposta no Simulador para adicionar leads automaticamente</p>
              <Button size="sm" variant="outline" onClick={onNewSimulacao}>
                <Plus className="w-4 h-4 mr-1.5" /> Criar Simulação
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Razão Social", "CNPJ", "TPV Monetto", "Economia Mensal", "Economia Anual", "Data"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="data-table-row">
                      <td className="px-4 py-3 font-medium text-foreground max-w-48 truncate">{lead.razao_social}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{lead.cnpj || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-white">{formatCurrency(lead.tpv)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">{formatCurrency(lead.economiaMensal)}</td>
                      <td className="px-4 py-3 font-semibold text-[#E8C97A]">{formatCurrency(lead.economiaAnual)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Tabela de Rebate ─────────────────────────────────────────────────────
function RebateTab({ selectedPlan, setSelectedPlan }: { selectedPlan: number; setSelectedPlan: (n: number) => void }) {
  const plan = PLANS[selectedPlan];

  return (
    <div className="space-y-4">
      {/* Plan selector */}
      <div className="flex flex-wrap gap-2">
        {PLANS.map((p, i) => (
          <button
            key={i}
            onClick={() => setSelectedPlan(i)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedPlan === i
                ? "bg-[#C9A84C]/15 text-[#E8C97A] border-[#C9A84C]/40"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Taxa table */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-white">Taxas — {plan.name}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Modalidade", "Visa", "Master", "Elo", "Amex"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODALITIES.map((mod) => {
                    const row = plan.taxa[mod];
                    if (!row) return null;
                    return (
                      <tr key={mod} className="border-b border-border/20 hover:bg-secondary/40 transition-colors">
                        <td className="px-3 py-1.5 font-medium text-foreground">{mod}</td>
                        <td className="px-3 py-1.5 text-blue-300">{pct(row.visa)}</td>
                        <td className="px-3 py-1.5 text-orange-300">{pct(row.master)}</td>
                        <td className="px-3 py-1.5 text-yellow-300">{pct(row.elo)}</td>
                        <td className="px-3 py-1.5 text-purple-300">{pct(row.amex)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Rebate table */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-[#E8C97A]">Rebates — {plan.name}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Modalidade", "Visa", "Master", "Elo", "Amex"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODALITIES.map((mod) => {
                    const row = plan.rebate[mod];
                    if (!row) return null;
                    return (
                      <tr key={mod} className="border-b border-border/20 hover:bg-secondary/40 transition-colors">
                        <td className="px-3 py-1.5 font-medium text-foreground">{mod}</td>
                        <td className="px-3 py-1.5 font-semibold text-[#E8C97A]">{pct(row.visa)}</td>
                        <td className="px-3 py-1.5 font-semibold text-[#E8C97A]">{pct(row.master)}</td>
                        <td className="px-3 py-1.5 font-semibold text-[#E8C97A]">{pct(row.elo)}</td>
                        <td className="px-3 py-1.5 font-semibold text-[#E8C97A]">{pct(row.amex)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#C9A84C]/20">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <span className="text-[#E8C97A] font-semibold">Rebate</span> é a comissão paga pela Monetto ao parceiro sobre o volume transacionado.
            Os valores acima são percentuais sobre o faturamento bruto por modalidade.
            Taxas e rebates variam conforme bandeira (Visa, Mastercard, Elo, Amex).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Simulador de Comissão ────────────────────────────────────────────────
function ComissaoTab({ selectedPlan, setSelectedPlan }: { selectedPlan: number; setSelectedPlan: (n: number) => void }) {
  const [values, setValues] = useState<Record<string, string>>({
    "PIX": "50000",
    "Débito": "20000",
    "Crédito à Vista (1x)": "10000",
    "Crédito Parcelado Média 2x a 6x": "20000",
    "Crédito Parcelado Média 7x a 12x": "3000",
    "Crédito Parcelado Média 13x a 17x": "10000",
    "Crédito Parcelado Média 18x a 21x": "30000",
  });

  const plan = PLANS[selectedPlan];

  const rows = useMemo(() => {
    return COMM_GROUPS.map((g) => {
      const rate = calcGroupAvg(plan, g.keys);
      const fat = n(values[g.label] ?? "0");
      const comm = fat * rate;
      return { ...g, rate, fat, comm };
    });
  }, [plan, values]);

  const totalFat = rows.reduce((s, r) => s + r.fat, 0);
  const totalComm = rows.reduce((s, r) => s + r.comm, 0);

  const reset = () => setValues({
    "PIX": "50000", "Débito": "20000", "Crédito à Vista (1x)": "10000",
    "Crédito Parcelado Média 2x a 6x": "20000",
    "Crédito Parcelado Média 7x a 12x": "3000",
    "Crédito Parcelado Média 13x a 17x": "10000",
    "Crédito Parcelado Média 18x a 21x": "30000",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p, i) => (
            <button key={i} onClick={() => setSelectedPlan(i)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                selectedPlan === i ? "bg-[#C9A84C]/15 text-[#E8C97A] border-[#C9A84C]/40" : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              }`}>
              {p.name}
            </button>
          ))}
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto">
          <RotateCcw className="w-3 h-3" /> Resetar
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Calculadora de Comissão — {plan.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {["Modalidade", "Taxa de Rebate (Média Visa)", "Faturamento (R$)", "Comissão (R$)"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-border/20">
                    <td className="px-4 py-3 text-foreground font-medium text-xs">{row.label}</td>
                    <td className="px-4 py-3 text-[#E8C97A] font-mono text-xs">
                      {(row.rate * 100).toFixed(4).replace(".", ",")}%
                    </td>
                    <td className="px-4 py-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <input
                          type="text"
                          value={values[row.label] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [row.label]: e.target.value }))}
                          className="w-36 h-8 pl-8 pr-2 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-400">
                      {formatCurrency(row.comm)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#C9A84C]/30 bg-[#C9A84C]/5">
                  <td className="px-4 py-3 font-bold text-[#E8C97A]">TOTAL</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 font-bold text-white">{formatCurrency(totalFat)}</td>
                  <td className="px-4 py-3 font-bold text-emerald-400 text-base">{formatCurrency(totalComm)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-emerald-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Comissão Mensal Estimada</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalComm)}</p>
          </CardContent>
        </Card>
        <Card className="border-[#C9A84C]/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Comissão Anual Estimada</p>
            <p className="text-2xl font-bold text-[#E8C97A] mt-1">{formatCurrency(totalComm * 12)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Simulador de Proposta ao Cliente ─────────────────────────────────────
function PropostaTab({ onAddLead }: { onAddLead: (lead: Lead) => void }) {
  // Dados do cliente
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  // TPV direto com Monetto (sem split %)
  const [tpvMonetto, setTpvMonetto] = useState("100000");
  // Plano selecionado: 0-6 = Planos 1-7, null = manual
  const [propostaPlan, setPropostaPlan] = useState<number | null>(null);
  // Mix de pagamentos (%)
  const [pixPct, setPixPct] = useState("18");
  const [debitoPct, setDebitoPct] = useState("35");
  const [cred1xPct, setCred1xPct] = useState("12");
  const [cred2a6Pct, setCred2a6Pct] = useState("20");
  const [cred7a12Pct, setCred7a12Pct] = useState("10");
  const [cred13a21Pct, setCred13a21Pct] = useState("5");
  // Concorrente taxas (%)
  const [concTaxaPix, setConcTaxaPix] = useState("1.19");
  const [concTaxaDebito, setConcTaxaDebito] = useState("1.99");
  const [concTaxaCred1x, setConcTaxaCred1x] = useState("3.49");
  const [concTaxaParc, setConcTaxaParc] = useState("4.99");
  // Monetto taxas (auto do plano ou manual)
  const [monTaxaPix, setMonTaxaPix] = useState("1.99");
  const [monTaxaDebito, setMonTaxaDebito] = useState("1.99");
  const [monTaxaCred1x, setMonTaxaCred1x] = useState("3.99");
  const [monTaxaCred2a6, setMonTaxaCred2a6] = useState("8.72");
  const [monTaxaCred7a12, setMonTaxaCred7a12] = useState("12.65");
  const [monTaxaCred13a21, setMonTaxaCred13a21] = useState("20.52");
  // Mensalidade e imposto
  const [mensalidadeAtual, setMensalidadeAtual] = useState("99");
  const [mensalidadeNova, setMensalidadeNova] = useState("199");
  const [aliquotaAtual, setAliquotaAtual] = useState("8.2");
  const [aliquotaNova, setAliquotaNova] = useState("0");

  // Helper: taxa média Visa de um grupo de modalidades
  const getPlanTaxa = (planIdx: number, keys: string[]): string => {
    const plan = PLANS[planIdx];
    const rates = keys
      .map((k) => { const v = plan.taxa[k]?.visa; return typeof v === "number" ? v : null; })
      .filter((v): v is number => v !== null);
    if (!rates.length) return "0";
    return ((rates.reduce((a, b) => a + b, 0) / rates.length) * 100).toFixed(2);
  };

  // Auto-fill taxas Monetto ao selecionar plano
  React.useEffect(() => {
    if (propostaPlan === null) return;
    setMonTaxaPix(getPlanTaxa(propostaPlan, ["PIX"]));
    setMonTaxaDebito(getPlanTaxa(propostaPlan, ["DÉBITO"]));
    setMonTaxaCred1x(getPlanTaxa(propostaPlan, ["Crédito 1x"]));
    setMonTaxaCred2a6(getPlanTaxa(propostaPlan, ["Crédito 2x","Crédito 3x","Crédito 4x","Crédito 5x","Crédito 6x"]));
    setMonTaxaCred7a12(getPlanTaxa(propostaPlan, ["Crédito 7x","Crédito 8x","Crédito 9x","Crédito 10x","Crédito 11x","Crédito 12x"]));
    setMonTaxaCred13a21(getPlanTaxa(propostaPlan, ["Crédito 13x","Crédito 14x","Crédito 15x","Crédito 16x","Crédito 17x","Crédito 18x","Crédito 19x","Crédito 20x","Crédito 21x"]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaPlan]);

  const calc = useMemo(() => {
    const tpv = n(tpvMonetto);
    const mods = [
      { label: "PIX",            pct: r(pixPct)/100,       concRate: r(concTaxaPix)/100,    monRate: r(monTaxaPix)/100 },
      { label: "Débito",         pct: r(debitoPct)/100,    concRate: r(concTaxaDebito)/100, monRate: r(monTaxaDebito)/100 },
      { label: "Crédito 1x",    pct: r(cred1xPct)/100,    concRate: r(concTaxaCred1x)/100, monRate: r(monTaxaCred1x)/100 },
      { label: "Crédito 2-6x",  pct: r(cred2a6Pct)/100,   concRate: r(concTaxaParc)/100,   monRate: r(monTaxaCred2a6)/100 },
      { label: "Crédito 7-12x", pct: r(cred7a12Pct)/100,  concRate: r(concTaxaParc)/100,   monRate: r(monTaxaCred7a12)/100 },
      { label: "Crédito 13-21x",pct: r(cred13a21Pct)/100, concRate: r(concTaxaParc)/100,   monRate: r(monTaxaCred13a21)/100 },
    ];
    let concSoma = 0, monSoma = 0;
    const rows = mods.map((m) => {
      const fat = m.pct > 0 ? tpv * m.pct : 0;
      const concCusto = fat * m.concRate;
      const monCusto  = fat * m.monRate;
      concSoma += concCusto;
      monSoma  += monCusto;
      return { label: m.label, pct: m.pct, fat, concCusto, monCusto };
    });
    const imposto      = tpv * (r(aliquotaAtual) / 100);
    const monImpostoVal = tpv * (r(aliquotaNova) / 100);
    const concTotal    = concSoma + imposto + n(mensalidadeAtual);
    const monTotal     = monSoma  + monImpostoVal + n(mensalidadeNova);
    const economiaMensal = concTotal - monTotal;
    const economiaAnual  = economiaMensal * 12;
    return { tpv, rows, concSoma, monSoma, imposto, monImpostoVal, concTotal, monTotal, economiaMensal, economiaAnual };
  }, [tpvMonetto, pixPct, debitoPct, cred1xPct, cred2a6Pct, cred7a12Pct, cred13a21Pct,
      concTaxaPix, concTaxaDebito, concTaxaCred1x, concTaxaParc,
      monTaxaPix, monTaxaDebito, monTaxaCred1x, monTaxaCred2a6, monTaxaCred7a12, monTaxaCred13a21,
      mensalidadeAtual, mensalidadeNova, aliquotaAtual, aliquotaNova]);

  const handlePrint = () => {
    const fmtR = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    const planLabel = propostaPlan !== null ? PLANS[propostaPlan].name : "Manual";
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Proposta Monetto — V3 PARTNERS</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Outfit',sans-serif;background:#fff;color:#1a1a2e;padding:40px;}
    .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:3px solid #C9A84C;margin-bottom:32px;}
    .brand-name{font-size:22px;font-weight:800;background:linear-gradient(120deg,#C9A84C,#E8C97A);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px;}
    .brand-sub{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:3px;margin-top:2px;}
    .doc-title{text-align:right;}
    .doc-title h1{font-size:18px;font-weight:700;color:#1a1a2e;}
    .doc-title p{font-size:11px;color:#666;margin-top:2px;}
    .gold-bar{height:4px;background:linear-gradient(90deg,#C9A84C,#E8C97A,#C9A84C);border-radius:2px;margin-bottom:32px;}
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#C9A84C;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #f0e6d3;}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
    .card{background:#f8f6f2;border-radius:12px;padding:20px;border:1px solid #f0e6d3;}
    .card-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
    .card-value{font-size:22px;font-weight:800;color:#C9A84C;}
    .card-value.green{color:#16a34a;}
    table{width:100%;border-collapse:collapse;margin-bottom:28px;}
    th{background:#f8f6f2;padding:10px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:2px solid #f0e6d3;}
    td{padding:10px 14px;font-size:12px;border-bottom:1px solid #f5f0ea;}
    .td-right{text-align:right;}
    .red{color:#dc2626;font-weight:600;}
    .gold{color:#C9A84C;font-weight:700;}
    .total-row td{font-weight:700;background:#fdf8f0;font-size:13px;}
    .savings-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:28px;}
    .saving-card{background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:18px;text-align:center;}
    .saving-card.gold-card{background:#fdf8f0;border-color:#f0e6d3;}
    .saving-card.blue-card{background:#eff6ff;border-color:#bfdbfe;}
    .saving-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
    .saving-value{font-size:20px;font-weight:800;color:#16a34a;}
    .saving-value.gold{color:#C9A84C;}
    .saving-value.blue{color:#2563eb;}
    .info-box{background:#fdf8f0;border:1px solid #f0e6d3;border-radius:10px;padding:16px;margin-bottom:28px;font-size:11px;color:#666;line-height:1.6;}
    .footer{border-top:2px solid #f0e6d3;padding-top:16px;display:flex;justify-content:space-between;align-items:center;margin-top:20px;}
    .footer-left{font-size:10px;color:#999;}
    .footer-brand{font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:1px;}
    @media print{body{padding:20px;}}
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-name">V3 PARTNERS</div>
      <div class="brand-sub">Plataforma Financeira</div>
    </div>
    <div class="doc-title">
      <h1>Proposta Comercial — Monetto Digital</h1>
      <p>Split Fiscal · Simulação de Economia · ${new Date().toLocaleDateString("pt-BR")} · ${planLabel}</p>
    </div>
  </div>
  <div class="gold-bar"></div>

  <div class="section-title">Dados do Cliente</div>
  <div class="grid2">
    <div class="card">
      <div class="card-label">Razão Social</div>
      <div class="card-value" style="font-size:16px">${razaoSocial || "—"}</div>
      ${cnpj ? `<div style="font-size:11px;color:#888;margin-top:4px">CNPJ: ${cnpj}</div>` : ""}
    </div>
    <div class="card">
      <div class="card-label">TPV Monetto / Mês</div>
      <div class="card-value">${fmtR(calc.tpv)}</div>
      <div style="font-size:11px;color:#888;margin-top:4px">Plano: ${planLabel}</div>
    </div>
  </div>

  <div class="section-title">Mix de Pagamentos</div>
  <table>
    <thead><tr><th>Modalidade</th><th class="td-right">% do Volume</th><th class="td-right">Faturamento (R$)</th></tr></thead>
    <tbody>
      ${calc.rows.filter(r => r.pct > 0).map(r => `<tr><td>${r.label}</td><td class="td-right">${(r.pct*100).toFixed(1)}%</td><td class="td-right">${fmtR(r.fat)}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="section-title">Custo Mensal: Concorrente vs Monetto ${planLabel}</div>
  <table>
    <thead><tr><th>Modalidade</th><th class="td-right">Concorrente (Stone/Getnet)</th><th class="td-right">Monetto ${planLabel}</th></tr></thead>
    <tbody>
      ${calc.rows.filter(r => r.pct > 0).map(r => `<tr><td>${r.label}</td><td class="td-right red">${fmtR(r.concCusto)}</td><td class="td-right gold">${fmtR(r.monCusto)}</td></tr>`).join("")}
      <tr><td>Subtotal Taxas</td><td class="td-right red">${fmtR(calc.concSoma)}</td><td class="td-right gold">${fmtR(calc.monSoma)}</td></tr>
      <tr><td>Impostos (${aliquotaAtual}% vs ${aliquotaNova}%)</td><td class="td-right red">${fmtR(calc.imposto)}</td><td class="td-right gold">${fmtR(calc.monImpostoVal)}</td></tr>
      <tr><td>Mensalidade</td><td class="td-right red">${fmtR(n(mensalidadeAtual))}</td><td class="td-right gold">${fmtR(n(mensalidadeNova))}</td></tr>
      <tr class="total-row"><td>TOTAL MENSAL</td><td class="td-right red">${fmtR(calc.concTotal)}</td><td class="td-right gold">${fmtR(calc.monTotal)}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Resultado Final — Economia com Monetto</div>
  <div class="savings-row">
    <div class="saving-card">
      <div class="saving-label">Economia Mensal</div>
      <div class="saving-value">${fmtR(Math.abs(calc.economiaMensal))}</div>
    </div>
    <div class="saving-card gold-card">
      <div class="saving-label">Economia Anual</div>
      <div class="saving-value gold">${fmtR(Math.abs(calc.economiaAnual))}</div>
    </div>
    <div class="saving-card blue-card">
      <div class="saving-label">Economia em 2 Anos</div>
      <div class="saving-value blue">${fmtR(Math.abs(calc.economiaAnual * 2))}</div>
    </div>
  </div>

  <div class="info-box">
    <strong>Observações:</strong> Simulação baseada no TPV informado e taxas do ${planLabel} Monetto Digital (média Visa por grupo de parcelamento).
    Modalidades com mix 0% não foram consideradas no cálculo. Custo = TPV × mix% × taxa por modalidade.
    Documento gerado pela plataforma V3 PARTNERS — ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}.
  </div>

  <div class="footer">
    <div class="footer-left">V3 PARTNERS — Plataforma Financeira · Uso Interno e Comercial</div>
    <div class="footer-brand">V3 PARTNERS</div>
  </div>
</body>
</html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);

    const leadLocal = {
      id: Date.now().toString(),
      razao_social: razaoSocial || "Cliente sem nome",
      cnpj,
      tpv: calc.tpv,
      economiaMensal: calc.economiaMensal,
      economiaAnual: calc.economiaAnual,
      created_at: new Date().toLocaleDateString("pt-BR"),
    };
    onAddLead(leadLocal);

    // Envia lead ao CRM automaticamente com a simulação em notas
    const simulacaoNota = [
      `[Split Fiscal — Simulação Automática]`,
      `Plano: ${propostaPlan !== null ? `Plano ${propostaPlan + 1}` : "Manual"}`,
      `TPV Mensal: R$ ${calc.tpv.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Custo Atual (concorrente): R$ ${calc.concTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Custo Monetto: R$ ${calc.monTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Economia Mensal: R$ ${calc.economiaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Economia Anual: R$ ${calc.economiaAnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Economia em 2 anos: R$ ${(calc.economiaAnual * 2).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Mix: PIX ${pixPct}% | Débito ${debitoPct}% | Créd 1x ${cred1xPct}% | Créd 2-6x ${cred2a6Pct}% | Créd 7-12x ${cred7a12Pct}% | Créd 13-21x ${cred13a21Pct}%`,
    ].join("\n");

    fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `SF-${Date.now().toString().slice(-6)}`,
        name: razaoSocial || "Cliente sem nome",
        document: cnpj || null,
        personType: "PJ",
        segment: "Split Fiscal / Maquininha",
        annualRevenue: Math.round(calc.tpv * 12),
        status: "prospect",
        source: "ativo",
        productInterest: "Split Fiscal",
        notes: simulacaoNota,
      }),
    }).catch(() => {}); // silencia erro — não bloqueia o fluxo
  };

  const inp = (label: string, value: string, set: (v: string) => void, prefix = "", suffix = "") => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-xs text-muted-foreground">{prefix}</span>}
        <input value={value} onChange={(e) => set(e.target.value)}
          className={`w-full h-8 ${prefix ? "pl-8" : "pl-3"} ${suffix ? "pr-8" : "pr-3"} text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 text-right`}
        />
        {suffix && <span className="absolute right-3 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );

  const MIX_ROWS = [
    { label: "PIX",            pct: pixPct,       setPct: setPixPct },
    { label: "Débito",         pct: debitoPct,    setPct: setDebitoPct },
    { label: "Crédito 1x",    pct: cred1xPct,    setPct: setCred1xPct },
    { label: "Crédito 2-6x",  pct: cred2a6Pct,   setPct: setCred2a6Pct },
    { label: "Crédito 7-12x", pct: cred7a12Pct,  setPct: setCred7a12Pct },
    { label: "Crédito 13-21x",pct: cred13a21Pct, setPct: setCred13a21Pct },
  ];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        {/* Card 1: Dados do Cliente */}
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {inp("Razão Social / Nome", razaoSocial, setRazaoSocial)}
            {inp("CNPJ", cnpj, setCnpj)}
            {inp("TPV com Monetto (R$/mês)", tpvMonetto, setTpvMonetto, "R$")}
            <div className="pt-1 border-t border-border/30">
              <p className="text-xs text-muted-foreground">TPV Monetto</p>
              <p className="text-lg font-bold text-[#E8C97A]">{formatCurrency(calc.tpv)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Mix de Pagamentos com faturamento inline */}
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mix de Pagamentos (%)</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {MIX_ROWS.map(({ label, pct: v, setPct }) => {
              const fat = r(v) > 0 ? calc.tpv * (r(v) / 100) : 0;
              return (
                <div key={label}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex items-center flex-1">
                      <input value={v} onChange={(e) => setPct(e.target.value)} placeholder="0"
                        className="w-full h-8 pl-3 pr-7 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 text-right" />
                      <span className="absolute right-2.5 text-xs text-muted-foreground">%</span>
                    </div>
                    <span className="text-xs font-semibold w-28 text-right shrink-0">
                      {fat > 0 ? <span className="text-[#E8C97A]">{formatCurrency(fat)}</span> : <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Card 3: Taxas — Plano Monetto + Concorrente */}
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taxas e Mensalidades</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {/* Plano Monetto selector */}
            <div>
              <p className="text-[10px] text-[#E8C97A] uppercase tracking-wider font-bold mb-2">Plano Monetto — selecione para preencher automático</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PLANS.map((p, i) => (
                  <button key={i} onClick={() => setPropostaPlan(i)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${propostaPlan === i ? "bg-[#C9A84C] border-[#C9A84C] text-white" : "border-border text-muted-foreground hover:border-[#C9A84C]/50"}`}>
                    {p.name.replace("Plano ", "P")}
                  </button>
                ))}
                <button onClick={() => setPropostaPlan(null)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${propostaPlan === null ? "bg-[#C9A84C] border-[#C9A84C] text-white" : "border-border text-muted-foreground hover:border-[#C9A84C]/50"}`}>
                  Manual
                </button>
              </div>
            </div>

            {/* Monetto taxas por modalidade */}
            <div className="space-y-1.5">
              <p className="text-[9px] text-[#C9A84C] uppercase tracking-wider font-semibold">Monetto — taxas por modalidade</p>
              {[
                { label: "PIX",            val: monTaxaPix,      set: setMonTaxaPix },
                { label: "Débito",         val: monTaxaDebito,   set: setMonTaxaDebito },
                { label: "Crédito 1x",    val: monTaxaCred1x,   set: setMonTaxaCred1x },
                { label: "Crédito 2-6x",  val: monTaxaCred2a6,  set: setMonTaxaCred2a6 },
                { label: "Crédito 7-12x", val: monTaxaCred7a12, set: setMonTaxaCred7a12 },
                { label: "Crédito 13-21x",val: monTaxaCred13a21,set: setMonTaxaCred13a21 },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
                  <div className="relative flex items-center flex-1">
                    <input value={val} onChange={(e) => set(e.target.value)} readOnly={propostaPlan !== null}
                      className={`w-full h-7 pl-2 pr-6 text-[11px] border rounded text-right focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 ${propostaPlan !== null ? "bg-[#C9A84C]/10 border-[#C9A84C]/30 text-[#E8C97A] cursor-default" : "bg-secondary border-border text-foreground"}`} />
                    <span className="absolute right-2 text-[10px] text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Concorrente taxas */}
            <div className="border-t border-border/30 pt-2 space-y-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Concorrente — taxas</p>
              {[
                { label: "PIX",        val: concTaxaPix,     set: setConcTaxaPix },
                { label: "Débito",     val: concTaxaDebito,  set: setConcTaxaDebito },
                { label: "Crédito 1x", val: concTaxaCred1x,  set: setConcTaxaCred1x },
                { label: "Parcelado",  val: concTaxaParc,    set: setConcTaxaParc },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
                  <div className="relative flex items-center flex-1">
                    <input value={val} onChange={(e) => set(e.target.value)}
                      className="w-full h-7 pl-2 pr-6 text-[11px] bg-secondary border border-border rounded text-foreground text-right focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
                    <span className="absolute right-2 text-[10px] text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mensalidade/impostos + Comparação */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensalidade e Impostos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {inp("Mensalidade Atual (R$)", mensalidadeAtual, setMensalidadeAtual, "R$")}
            {inp("Nova Mensalidade (R$)", mensalidadeNova, setMensalidadeNova, "R$")}
            {inp("Alíquota Imposto Atual (%)", aliquotaAtual, setAliquotaAtual, "", "%")}
            {inp("Alíquota Monetto (%)", aliquotaNova, setAliquotaNova, "", "%")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custo Mensal: Concorrente vs Monetto</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="grid grid-cols-3 gap-2 border-b border-border/30 pb-2 text-[10px] font-semibold text-muted-foreground uppercase">
              <span>Modalidade</span><span className="text-right">Concorrente</span><span className="text-right text-[#E8C97A]">Monetto</span>
            </div>
            {calc.rows.map((r) => (
              <div key={r.label} className={`grid grid-cols-3 gap-2 ${r.pct === 0 ? "opacity-30" : ""}`}>
                <span className="text-muted-foreground text-[11px]">{r.label}</span>
                <span className="text-right text-red-400">{r.pct > 0 ? formatCurrency(r.concCusto) : "—"}</span>
                <span className="text-right text-emerald-400">{r.pct > 0 ? formatCurrency(r.monCusto) : "—"}</span>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 border-t border-border/30 pt-1.5">
              <span className="text-muted-foreground text-[11px]">Subtotal Taxas</span>
              <span className="text-right text-red-400">{formatCurrency(calc.concSoma)}</span>
              <span className="text-right text-emerald-400">{formatCurrency(calc.monSoma)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground text-[11px]">Impostos</span>
              <span className="text-right text-red-400">{formatCurrency(calc.imposto)}</span>
              <span className="text-right text-emerald-400">{formatCurrency(calc.monImpostoVal)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground text-[11px]">Mensalidade</span>
              <span className="text-right text-red-400">{formatCurrency(n(mensalidadeAtual))}</span>
              <span className="text-right text-emerald-400">{formatCurrency(n(mensalidadeNova))}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t-2 border-[#C9A84C]/30 pt-2 font-bold">
              <span className="text-foreground text-[11px]">TOTAL</span>
              <span className="text-right text-red-400">{formatCurrency(calc.concTotal)}</span>
              <span className="text-right text-[#E8C97A]">{formatCurrency(calc.monTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Result highlights */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground">Economia Mensal</p>
            <p className={`text-2xl font-bold mt-1 ${calc.economiaMensal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(Math.abs(calc.economiaMensal))}
            </p>
            {calc.economiaMensal < 0 && <p className="text-[10px] text-red-400 mt-0.5">custo maior</p>}
          </CardContent>
        </Card>
        <Card className="border-[#C9A84C]/30 bg-[#C9A84C]/5">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground">Economia Anual</p>
            <p className={`text-2xl font-bold mt-1 ${calc.economiaMensal >= 0 ? "text-[#E8C97A]" : "text-red-400"}`}>
              {formatCurrency(Math.abs(calc.economiaAnual))}
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground">Economia em 2 Anos</p>
            <p className={`text-2xl font-bold mt-1 ${calc.economiaMensal >= 0 ? "text-blue-400" : "text-red-400"}`}>
              {formatCurrency(Math.abs(calc.economiaAnual * 2))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dica + PDF */}
      <div className="flex items-start gap-4">
        <Card className="flex-1 border-[#C9A84C]/20 bg-[#C9A84C]/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">
              <span className="text-[#E8C97A] font-semibold">Dica:</span>{" "}
              Selecione um Plano (P1–P7) para preencher as taxas Monetto automaticamente pela média Visa.
              No mix, deixe 0% nas modalidades que o cliente não usa — elas ficam zeradas e não entram no cálculo.
              Fórmula: <span className="text-foreground/70">TPV × mix% × taxa = custo da modalidade.</span>
            </p>
          </CardContent>
        </Card>
        <Button onClick={handlePrint} size="sm" className="gap-2 bg-[#C9A84C] hover:bg-[#E8C97A] text-white shrink-0 self-center">
          <FileDown className="w-4 h-4" /> Gerar Proposta PDF
        </Button>
      </div>
    </div>
  );
}
