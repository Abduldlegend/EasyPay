import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Button, Field } from '../components/ui.jsx';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await login(values);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (error) {
      setFormError(error.message);
    }
  };

  return (
    <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div><h2 className="auth-title">Welcome back</h2><p className="muted">Log in to your wallet</p></div>
      <Alert>{formError}</Alert>
      <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
      <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
      <Button type="submit" loading={isSubmitting}>Log in</Button>
      <p className="muted center">No account? <Link to="/register">Create one</Link></p>
    </form>
  );
}
