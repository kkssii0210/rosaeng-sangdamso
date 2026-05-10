export const bomberAccessoryRegression = {
  equipment: [
    {
      Type: "무기",
      WeaponStats: {
        AdditionalDamage: {
          Value: 29.61
        }
      }
    },
    {
      Type: "목걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["적에게 주는 피해 +2.00%", "최대 마나 +15", "추가 피해 +1.60%"]
        }
      ]
    },
    {
      Type: "반지",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["치명타 피해 +2.40%", "치명타 적중률 +1.55%"]
        }
      ]
    },
    {
      Type: "반지",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["치명타 피해 +4.00%", "치명타 적중률 +0.40%"]
        }
      ]
    }
  ],
  criticalStats: {
    GlobalCriticalRatePercent: 57.56,
    ConditionalCriticalRatePercent: 20,
    GlobalCriticalDamageBonusPercent: 78.4,
    ConditionalCriticalDamageBonusPercent: 0,
    CriticalOutgoingDamagePercent: 0,
    ConditionalCriticalOutgoingDamagePercent: 14.6,
    GlobalAttackPowerPercent: 0,
    ConditionalAttackPowerPercent: 5.4,
    GlobalWeaponPowerPercent: 2.5,
    ConditionalWeaponPowerPercent: 0,
    GlobalAdditionalDamagePercent: 8.5,
    ConditionalAdditionalDamagePercent: 0,
    FixedEvolutionDamagePercent: 50,
    CriticalRateLimit: {
      IsActive: true,
      CapPercent: 80,
      OverflowConversionRatePercent: 150,
      MaxConvertedEvolutionDamagePercent: 75
    }
  }
};
