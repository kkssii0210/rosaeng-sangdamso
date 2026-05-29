package com.rosaeng.sangdamso.spec;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class UpgradeEfficiencyConstants {

    static final double SOURCE_BASE_COEFFICIENT = 0.0288;
    static final double IN_GAME_DISPLAY_SCALE = 0.01;
    static final double JANGIN_ACCUMULATE_DIVIDER = 2.15;
    static final List<Integer> ENGRAVING_BOOK_COUNTS = List.of(0, 5, 10, 15, 20);
    static final Map<Integer, Integer> ENGRAVING_BOOK_COUNT_BY_LEVEL = Map.of(0, 0, 1, 5, 2, 10, 3, 15, 4, 20);
    static final Map<Integer, Double> GEM_BASIC_ATTACK_PERCENT_BY_LEVEL = Map.of(7, 0.6, 8, 0.8, 9, 1.0, 10, 1.2);
    static final Map<Integer, Double> GEM_PURE_COMBAT_POWER_FACTORS = Map.of(
        1, 1.28,
        2, 1.92,
        3, 2.56,
        4, 3.2,
        5, 3.84,
        6, 4.48,
        7, 5.12,
        8, 5.76,
        9, 6.4,
        10, 7.04
    );
    static final Map<Integer, Double> WEAPON_POWER_BY_LEVEL = Map.ofEntries(
        Map.entry(11, 167706.0),
        Map.entry(12, 172473.0),
        Map.entry(13, 177406.0),
        Map.entry(14, 182514.0),
        Map.entry(15, 187799.0),
        Map.entry(16, 193270.0),
        Map.entry(17, 198101.0),
        Map.entry(18, 203054.0),
        Map.entry(19, 208130.0),
        Map.entry(20, 213333.0),
        Map.entry(21, 218667.0),
        Map.entry(22, 224133.0),
        Map.entry(23, 229737.0),
        Map.entry(24, 235480.0),
        Map.entry(25, 241367.0)
    );
    static final Map<String, List<Double>> ARMOR_MAIN_STAT_BY_SLOT = Map.of(
        "투구", List.of(96801.0, 99554.0, 102404.0, 105353.0, 108406.0, 111565.0, 114358.0, 117218.0, 120150.0, 123155.0, 126236.0, 129393.0, 132629.0, 135946.0, 139346.0),
        "어깨", List.of(103023.0, 105954.0, 108987.0, 112126.0, 115375.0, 118738.0, 121709.0, 124754.0, 127874.0, 131072.0, 134351.0, 137711.0, 141155.0, 144686.0, 148304.0),
        "상의", List.of(77441.0, 79643.0, 81923.0, 84282.0, 86724.0, 89251.0, 91485.0, 93773.0, 96119.0, 98523.0, 100988.0, 103514.0, 106103.0, 108757.0, 111477.0),
        "하의", List.of(83664.0, 86043.0, 88506.0, 91055.0, 93694.0, 96424.0, 98838.0, 101310.0, 103844.0, 106441.0, 109104.0, 111833.0, 114630.0, 117497.0, 120436.0),
        "장갑", List.of(116161.0, 119465.0, 122885.0, 126424.0, 130088.0, 133879.0, 137231.0, 140663.0, 144181.0, 147787.0, 151484.0, 155272.0, 159155.0, 163135.0, 167215.0)
    );
    static final Map<Integer, Double> HONING_PROBABILITY_BY_TARGET_LEVEL = Map.ofEntries(
        Map.entry(12, 0.05),
        Map.entry(13, 0.05),
        Map.entry(14, 0.04),
        Map.entry(15, 0.04),
        Map.entry(16, 0.04),
        Map.entry(17, 0.03),
        Map.entry(18, 0.03),
        Map.entry(19, 0.03),
        Map.entry(20, 0.015),
        Map.entry(21, 0.015),
        Map.entry(22, 0.01),
        Map.entry(23, 0.01),
        Map.entry(24, 0.005),
        Map.entry(25, 0.005)
    );
    static final Map<Integer, HoningBreath> HONING_BREATH_BY_TARGET_LEVEL = Map.ofEntries(
        Map.entry(12, new HoningBreath(20, 0.0025)),
        Map.entry(13, new HoningBreath(20, 0.0025)),
        Map.entry(14, new HoningBreath(20, 0.002)),
        Map.entry(15, new HoningBreath(20, 0.002)),
        Map.entry(16, new HoningBreath(20, 0.002)),
        Map.entry(17, new HoningBreath(25, 0.0012)),
        Map.entry(18, new HoningBreath(25, 0.0012)),
        Map.entry(19, new HoningBreath(25, 0.0012)),
        Map.entry(20, new HoningBreath(25, 0.0006)),
        Map.entry(21, new HoningBreath(25, 0.0006)),
        Map.entry(22, new HoningBreath(25, 0.0004)),
        Map.entry(23, new HoningBreath(25, 0.0004)),
        Map.entry(24, new HoningBreath(50, 0.0002)),
        Map.entry(25, new HoningBreath(50, 0.0002))
    );
    static final Map<Integer, HoningAmounts> WEAPON_HONING_AMOUNTS_BY_TARGET_LEVEL = Map.ofEntries(
        Map.entry(12, new HoningAmounts(1700, 17, 18, 15890, 4050)),
        Map.entry(13, new HoningAmounts(1890, 19, 21, 17660, 4500)),
        Map.entry(14, new HoningAmounts(2080, 21, 23, 19420, 4950)),
        Map.entry(15, new HoningAmounts(2270, 23, 25, 21190, 5400)),
        Map.entry(16, new HoningAmounts(2460, 25, 27, 22960, 5850)),
        Map.entry(17, new HoningAmounts(2690, 28, 29, 25120, 6400)),
        Map.entry(18, new HoningAmounts(2900, 30, 32, 27080, 6900)),
        Map.entry(19, new HoningAmounts(3110, 32, 34, 29040, 7400)),
        Map.entry(20, new HoningAmounts(3340, 34, 37, 31200, 7950)),
        Map.entry(21, new HoningAmounts(3570, 37, 39, 33360, 8500)),
        Map.entry(22, new HoningAmounts(3800, 39, 42, 35520, 9050)),
        Map.entry(23, new HoningAmounts(4030, 42, 44, 37680, 9600)),
        Map.entry(24, new HoningAmounts(4260, 44, 47, 39840, 10150)),
        Map.entry(25, new HoningAmounts(4500, 47, 50, 42000, 10700))
    );
    static final Map<Integer, HoningAmounts> ARMOR_HONING_AMOUNTS_BY_TARGET_LEVEL = Map.ofEntries(
        Map.entry(12, new HoningAmounts(930, 11, 11, 9570, 2450)),
        Map.entry(13, new HoningAmounts(1030, 12, 12, 10540, 2700)),
        Map.entry(14, new HoningAmounts(1120, 13, 13, 11520, 2950)),
        Map.entry(15, new HoningAmounts(1240, 14, 15, 12690, 3250)),
        Map.entry(16, new HoningAmounts(1330, 15, 16, 13670, 3500)),
        Map.entry(17, new HoningAmounts(1450, 17, 17, 14840, 3800)),
        Map.entry(18, new HoningAmounts(1560, 18, 19, 16010, 4100)),
        Map.entry(19, new HoningAmounts(1700, 20, 20, 17380, 4450)),
        Map.entry(20, new HoningAmounts(1810, 21, 22, 18550, 4750)),
        Map.entry(21, new HoningAmounts(1950, 23, 23, 19920, 5100)),
        Map.entry(22, new HoningAmounts(2080, 24, 25, 21280, 5450)),
        Map.entry(23, new HoningAmounts(2200, 26, 26, 22460, 5750)),
        Map.entry(24, new HoningAmounts(2330, 27, 28, 23820, 6100)),
        Map.entry(25, new HoningAmounts(2450, 29, 30, 25000, 6400))
    );
    static final Map<String, Integer> SHARD_POUCH_SIZES = Map.of(
        "운명의 파편 주머니(소)", 500,
        "운명의 파편 주머니(중)", 1000,
        "운명의 파편 주머니(대)", 1500
    );
    static final Map<String, double[][]> ENGRAVING_COMBAT_POWER_TABLES = engravingTables();

    private UpgradeEfficiencyConstants() {
    }

    private static Map<String, double[][]> engravingTables() {
        Map<String, double[][]> tables = new LinkedHashMap<>();
        put(tables, List.of("원한"), table(
            row(18, 21, 21.75, 23.25, 24),
            row(18.75, 21.75, 22.5, 24, 24.75),
            row(19.5, 22.5, 23.25, 24.75, 25.5),
            row(20.25, 23.25, 24, 25.5, 26.25),
            row(21, 24, 24.75, 26.25, 27)
        ));
        put(tables, List.of("아드레날린"), table(
            row(15.2, 18.08, 18.8, 20.18, 20.9),
            row(16.25, 19.13, 19.85, 21.23, 21.95),
            row(17.3, 20.18, 20.9, 22.28, 23),
            row(18.35, 21.23, 21.95, 23.33, 24.05),
            row(19.4, 22.28, 23, 24.38, 25.1)
        ));
        put(tables, List.of("돌격대장"), table(
            row(16, 19, 19.76, 21.28, 22),
            row(16.8, 19.8, 20.56, 22.08, 22.8),
            row(17.6, 20.6, 21.36, 22.88, 23.6),
            row(18.4, 21.4, 22.16, 23.68, 24.4),
            row(19.2, 22.2, 22.96, 24.48, 25.2)
        ));
        put(tables, List.of("질량증가"), table(
            row(16, 19, 19.75, 21.25, 22),
            row(16.75, 19.75, 20.5, 22, 22.75),
            row(17.5, 20.5, 21.25, 22.75, 23.5),
            row(18.25, 21.25, 22, 23.5, 24.25),
            row(19, 22, 22.75, 24.25, 25)
        ));
        put(tables, List.of("결투의대가", "기습의대가"), table(
            row(15.3, 18, 18.7, 20, 20.7),
            row(16, 18.7, 19.4, 20.7, 21.4),
            row(16.7, 19.4, 20.1, 21.4, 22.1),
            row(17.4, 20.1, 20.8, 22.1, 22.8),
            row(18.1, 20.8, 21.5, 22.8, 23.5)
        ));
        put(tables, List.of("예리한둔기"), table(
            row(14.39, 17.18, 17.89, 19.31, 19.98),
            row(15.13, 17.92, 18.63, 20.05, 20.72),
            row(15.88, 18.67, 19.38, 20.8, 21.47),
            row(16.62, 19.41, 20.12, 21.54, 22.21),
            row(17.36, 20.15, 20.86, 22.28, 22.95)
        ));
        put(tables, List.of("달인의저력", "바리케이드", "안정된상태", "저주받은인형", "타격의대가"), table(
            row(14, 17, 17.75, 19.25, 20),
            row(14.75, 17.75, 18.5, 20, 20.75),
            row(15.5, 18.5, 19.25, 20.75, 21.5),
            row(16.25, 19.25, 20, 21.5, 22.25),
            row(17, 20, 20.75, 22.25, 23)
        ));
        put(tables, List.of("속전속결", "슈퍼차지"), table(
            row(14.4, 16.8, 17.4, 18.6, 19.2),
            row(15, 17.4, 18, 19.2, 19.8),
            row(15.6, 18, 18.6, 19.8, 20.4),
            row(16.2, 18.6, 19.2, 20.4, 21),
            row(16.8, 19.2, 19.8, 21, 21.6)
        ));
        put(tables, List.of("에테르포식자"), table(
            row(12.6, 15.6, 16.5, 18, 18.6),
            row(13.5, 16.5, 17.4, 18.9, 19.5),
            row(14.4, 17.4, 18.3, 19.8, 20.4),
            row(15.3, 18.3, 19.2, 20.7, 21.3),
            row(16.2, 19.2, 20.1, 21.6, 22.2)
        ));
        put(tables, List.of("마나효율증가"), table(
            row(13, 16, 16.75, 18.25, 19),
            row(13.75, 16.75, 17.5, 19, 19.75),
            row(14.5, 17.5, 18.25, 19.75, 20.5),
            row(15.25, 18.25, 19, 20.5, 21.25),
            row(16, 19, 19.75, 21.25, 22)
        ));
        put(tables, List.of("약자무시"), table(
            row(9.9, 12.3, 12.9, 14.1, 14.7),
            row(10.73, 13.13, 13.73, 14.93, 15.53),
            row(11.55, 13.95, 14.55, 15.75, 16.35),
            row(12.38, 14.78, 15.38, 16.58, 17.18),
            row(13.2, 15.6, 16.2, 17.4, 18)
        ));
        put(tables, List.of("정밀단도"), table(
            row(10.6, 12.7, 13.23, 14.28, 14.8),
            row(11.13, 13.23, 13.76, 14.81, 15.33),
            row(11.65, 13.75, 14.28, 15.33, 15.85),
            row(12.18, 14.28, 14.81, 15.86, 16.38),
            row(12.7, 14.8, 15.33, 16.38, 16.9)
        ));
        put(tables, List.of("추진력"), table(
            row(9.8, 11.9, 12.43, 13.48, 14),
            row(10.33, 12.43, 12.96, 14.01, 14.53),
            row(10.85, 12.95, 13.48, 14.53, 15.05),
            row(11.38, 13.48, 14.01, 15.06, 15.58),
            row(11.9, 14, 14.53, 15.58, 16.1)
        ));
        put(tables, List.of("마나의흐름"), table(
            row(7.53, 7.53, 7.53, 7.53, 7.53),
            row(8.4, 8.4, 8.4, 8.4, 8.4),
            row(9.29, 9.29, 9.29, 9.29, 9.29),
            row(10.2, 10.2, 10.2, 10.2, 10.2),
            row(11.11, 11.11, 11.11, 11.11, 11.11)
        ));
        put(tables, List.of("시선집중"), table(
            row(7.5, 8.7, 9, 9.6, 9.9),
            row(7.88, 9.08, 9.38, 9.98, 10.28),
            row(8.25, 9.45, 9.75, 10.35, 10.65),
            row(8.63, 9.83, 10.13, 10.73, 11.03),
            row(9, 10.2, 10.5, 11.1, 11.4)
        ));
        put(tables, List.of("부러진뼈"), table(
            row(7.4, 8.2, 8.4, 8.8, 9),
            row(7.65, 8.45, 8.65, 9.05, 9.25),
            row(7.9, 8.7, 8.9, 9.3, 9.5),
            row(8.15, 8.95, 9.15, 9.55, 9.75),
            row(8.4, 9.2, 9.4, 9.8, 10)
        ));
        put(tables, List.of("실드관통"), table(
            row(4.6, 5.4, 5.6, 6, 6.2),
            row(4.8, 5.6, 5.8, 6.2, 6.4),
            row(5, 5.8, 6, 6.4, 6.6),
            row(5.2, 6, 6.2, 6.6, 6.8),
            row(5.4, 6.2, 6.4, 6.8, 7)
        ));
        put(tables, List.of("구슬동자"), table(
            row(4, 4.48, 4.6, 4.84, 4.96),
            row(4.16, 4.64, 4.76, 5, 5.12),
            row(4.32, 4.8, 4.92, 5.16, 5.28),
            row(4.48, 4.96, 5.08, 5.32, 5.44),
            row(4.64, 5.12, 5.24, 5.48, 5.6)
        ));
        put(tables, List.of("승부사"), table(
            row(1.68, 1.98, 2.06, 2.21, 2.28),
            row(1.68, 1.98, 2.06, 2.21, 2.28),
            row(1.89, 2.19, 2.27, 2.42, 2.49),
            row(1.89, 2.19, 2.27, 2.42, 2.49),
            row(2.1, 2.4, 2.48, 2.63, 2.7)
        ));
        put(tables, List.of("분쇄의주먹"), table(
            row(1.3, 1.45, 1.49, 1.56, 1.6),
            row(1.38, 1.53, 1.57, 1.64, 1.68),
            row(1.45, 1.6, 1.64, 1.71, 1.75),
            row(1.53, 1.68, 1.72, 1.79, 1.83),
            row(1.6, 1.75, 1.79, 1.86, 1.9)
        ));
        return Map.copyOf(tables);
    }

    private static void put(Map<String, double[][]> tables, List<String> keys, double[][] table) {
        for (String key : keys) {
            tables.put(key, table);
        }
    }

    private static double[][] table(double[]... rows) {
        return rows;
    }

    private static double[] row(double... values) {
        return values;
    }

    record HoningBreath(int max, double probability) {
    }

    record HoningAmounts(int stone, int leapstone, int fusion, int shard, int gold) {
    }
}
