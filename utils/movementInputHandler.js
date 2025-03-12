export const  getExpenseConfig = (body) => ({
  sourceAccountName: body.account,
  destinationAccountName: body.category,
  sourceAccountTypeName: 'bank',
  destinationAccountTypeName: 'category_budget',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const  getIncomeConfig = (body) => ({
  sourceAccountName: body.incomeSource,
  destinationAccountName: body.account,
  sourceAccountTypeName: 'income_source',
  destinationAccountTypeName: 'bank',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const  getInvestmentConfig = (body) => ({
  sourceAccountName: body.transactionTypeName === 'deposit' ? body.account : 'cash',
  destinationAccountName: body.transactionTypeName === 'deposit' ? 'cash' : body.account,
  sourceAccountTypeName: body.transactionTypeName === 'deposit' ? body.account : 'cash',
  destinationAccountTypeName: body.transactionTypeName === 'deposit' ? 'cash' : body.account,
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const  getPocketConfig = (body) => ({
  sourceAccountName: body.transactionTypeName === 'deposit' ? body.account : 'cash',
  destinationAccountName: body.transactionTypeName === 'deposit' ? 'cash' : body.account,
  sourceAccountTypeName: body.transactionTypeName === 'deposit' ? body.account : 'cash',
  destinationAccountTypeName: body.transactionTypeName === 'deposit' ? 'cash' : body.account,
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const  getDebtorConfig = (body) => ({
  sourceAccountName: body.transactionTypeName === 'lend' ? body.debtor : 'cash',
  destinationAccountName: body.transactionTypeName === 'lend' ? 'cash' : body.debtor,
  sourceAccountTypeName: body.transactionTypeName === 'lend' ? body.debtor : 'cash',
  destinationAccountTypeName: body.transactionTypeName === 'lend' ? 'cash' : body.debtor,
  sourceAccountTransactionType: 'borrow',
  destinationAccountTransactionType: 'lend',
});

