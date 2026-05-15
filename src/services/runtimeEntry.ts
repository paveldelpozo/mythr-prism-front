export type RuntimeEntry = 'master' | 'remote' | 'slave';

export const resolveRuntimeEntry = (pathname: string): RuntimeEntry => {
  if (pathname.endsWith('/slave.html')) {
    return 'slave';
  }

  if (pathname === '/remote') {
    return 'remote';
  }

  return 'master';
};
