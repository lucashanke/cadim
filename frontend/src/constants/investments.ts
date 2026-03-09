export const INVESTMENT_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  MUTUAL_FUND:        { label: 'Mutual Fund',      className: 'bg-blue-500/10 text-blue-400/80 border-blue-500/15' },
  SECURITY:           { label: 'Security',          className: 'bg-violet-500/10 text-violet-400/80 border-violet-500/15' },
  EQUITY:             { label: 'Equity',            className: 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/15' },
  FIXED_INCOME:       { label: 'Fixed Income',      className: 'bg-amber-500/10 text-amber-400/80 border-amber-500/15' },
  TREASURE:           { label: 'Treasury',          className: 'bg-yellow-500/10 text-yellow-400/80 border-yellow-500/15' },
  PENSION:            { label: 'Pension',           className: 'bg-pink-500/10 text-pink-400/80 border-pink-500/15' },
  REAL_ESTATE_FUND:   { label: 'Real Estate',       className: 'bg-orange-500/10 text-orange-400/80 border-orange-500/15' },
  ETF:                { label: 'ETF',               className: 'bg-cyan-500/10 text-cyan-400/80 border-cyan-500/15' },
  COE:                { label: 'COE',               className: 'bg-indigo-500/10 text-indigo-400/80 border-indigo-500/15' },
  OTHER:              { label: 'Other',             className: 'bg-secondary text-muted-foreground/70 border-border' },
}

export const INVESTMENT_TYPE_COLORS: Record<string, string> = {
  MUTUAL_FUND:      '#4080d0',       // medium blue
  SECURITY:         '#8060e8',       // warm violet — 4th most common, looks premium
  EQUITY:           '#20a868',       // fresh emerald — 3rd most common
  FIXED_INCOME:     '#e09020',       // investment gold — most common, richest color
  TREASURE:         '#b89820',       // warm olive-gold (less common than FIXED_INCOME)
  PENSION:          '#cc5080',       // rose
  REAL_ESTATE_FUND: '#c87030',       // terracotta
  ETF:              '#1898c0',       // teal
  COE:              '#5c68f0',       // strong indigo — 2nd most common, looks premium
  OTHER:            '#6880a0',       // slate
}

// Maps each subtype to its parent investment type (determines shade family in charts)
export const SUBTYPE_PARENT_TYPE: Record<string, string> = {
  // FIXED_INCOME
  CDB: 'FIXED_INCOME', LCI: 'FIXED_INCOME', LCA: 'FIXED_INCOME',
  CRI: 'FIXED_INCOME', CRA: 'FIXED_INCOME', DEBENTURES: 'FIXED_INCOME',
  DEBENTURE: 'FIXED_INCOME', LC: 'FIXED_INCOME', LIG: 'FIXED_INCOME',
  LF: 'FIXED_INCOME', TREASURY: 'FIXED_INCOME', POUPANCA: 'FIXED_INCOME',
  // TREASURE
  TESOURO_SELIC: 'TREASURE', TESOURO_IPCA: 'TREASURE', TESOURO_PREFIXADO: 'TREASURE',
  // EQUITY
  STOCK: 'EQUITY', STOCKS: 'EQUITY', BDR: 'EQUITY',
  REAL_ESTATE_FUND: 'EQUITY', DERIVATIVES: 'EQUITY', OPTION: 'EQUITY',
  // MUTUAL_FUND
  INVESTMENT_FUND: 'MUTUAL_FUND', STOCK_FUND: 'MUTUAL_FUND', FUNDO_ACOES: 'MUTUAL_FUND',
  MULTIMARKET_FUND: 'MUTUAL_FUND', FUNDO_MULTIMERCADO: 'MUTUAL_FUND',
  FIXED_INCOME_FUND: 'MUTUAL_FUND', FUNDO_RENDA_FIXA: 'MUTUAL_FUND',
  EXCHANGE_FUND: 'MUTUAL_FUND', FIP_FUND: 'MUTUAL_FUND',
  ETF_FUND: 'MUTUAL_FUND', OFFSHORE_FUND: 'MUTUAL_FUND',
  // REAL_ESTATE_FUND (type)
  FII: 'REAL_ESTATE_FUND',
  // ETF (type)
  ETF: 'ETF',
  // SECURITY
  RETIREMENT: 'SECURITY', PGBL: 'SECURITY', VGBL: 'SECURITY',
  // COE
  STRUCTURED_NOTE: 'COE', COE: 'COE',
}

// Sibling lists per type in definition order — position determines which lightness shade each gets
export const SUBTYPE_SIBLINGS: Record<string, string[]> = {}
Object.entries(SUBTYPE_PARENT_TYPE).forEach(([sub, type]) => {
  ;(SUBTYPE_SIBLINGS[type] ??= []).push(sub)
})

export const SUBTYPE_LABELS: Record<string, { label: string }> = {
  // Fixed Income
  CDB:                  { label: 'CDB'              },
  LCI:                  { label: 'LCI'              },
  LCA:                  { label: 'LCA'              },
  CRI:                  { label: 'CRI'              },
  CRA:                  { label: 'CRA'              },
  DEBENTURE:            { label: 'Debênture'        },
  DEBENTURES:           { label: 'Debêntures'       },
  LC:                   { label: 'LC'               },
  LIG:                  { label: 'LIG'              },
  LF:                   { label: 'LF'               },
  TREASURY:             { label: 'Tesouro'          },
  POUPANCA:             { label: 'Poupança'         },
  // Treasury (Pluggy subtypes)
  TESOURO_SELIC:        { label: 'Tesouro Selic'    },
  TESOURO_IPCA:         { label: 'Tesouro IPCA+'   },
  TESOURO_PREFIXADO:    { label: 'Tesouro Pré'     },
  // Equity
  STOCK:                { label: 'Ações'            },
  STOCKS:               { label: 'Ações'            },
  BDR:                  { label: 'BDR'              },
  REAL_ESTATE_FUND:     { label: 'FII'              },
  DERIVATIVES:          { label: 'Derivativos'      },
  OPTION:               { label: 'Opção'            },
  // Funds
  FII:                  { label: 'FII'              },
  ETF:                  { label: 'ETF'              },
  ETF_FUND:             { label: 'ETF Fund'         },
  INVESTMENT_FUND:      { label: 'Fundo de Invest.' },
  STOCK_FUND:           { label: 'Fundo de Ações'   },
  MULTIMARKET_FUND:     { label: 'Multimercado'     },
  EXCHANGE_FUND:        { label: 'Fundo Cambial'    },
  FIXED_INCOME_FUND:    { label: 'Renda Fixa'       },
  FIP_FUND:             { label: 'FIP'              },
  OFFSHORE_FUND:        { label: 'Offshore'         },
  FUNDO_MULTIMERCADO:   { label: 'Multimercado'     },
  FUNDO_RENDA_FIXA:     { label: 'Renda Fixa'       },
  FUNDO_ACOES:          { label: 'Fundo de Ações'   },
  // Pension / Retirement
  RETIREMENT:           { label: 'Previdência'      },
  PGBL:                 { label: 'PGBL'             },
  VGBL:                 { label: 'VGBL'             },
  // COE
  COE:                  { label: 'COE'              },
  STRUCTURED_NOTE:      { label: 'Nota Estruturada' },
}

export const MANUAL_TYPE_SUBTYPES: Record<string, string[]> = {
  FIXED_INCOME: ['CRI', 'CRA', 'LCI', 'LCA', 'LC', 'TREASURY', 'DEBENTURES', 'CDB', 'LIG', 'LF'],
  SECURITY:     ['RETIREMENT', 'PGBL', 'VGBL'],
  MUTUAL_FUND:  ['INVESTMENT_FUND', 'STOCK_FUND', 'MULTIMARKET_FUND', 'EXCHANGE_FUND', 'FIXED_INCOME_FUND', 'FIP_FUND', 'OFFSHORE_FUND', 'ETF_FUND'],
  EQUITY:       ['STOCK', 'BDR', 'REAL_ESTATE_FUND', 'DERIVATIVES', 'OPTION'],
  ETF:          ['ETF'],
  COE:          ['STRUCTURED_NOTE'],
}
