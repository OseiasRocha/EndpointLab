import jetPaths from 'jet-paths';

const Paths = {
  _: '/api',
  Endpoints: {
    _: '/endpoints',
    GetAll: '/',
    Create: '/',
    Update: '/:id',
    Delete: '/:id',
    Send: '/:id/send',
  },
} as const;

export const JetPaths = jetPaths(Paths);
export default Paths;
