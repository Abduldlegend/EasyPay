import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Button, Field } from '../components/ui.jsx';
import { applyServerErrors } from '../utils/errors.js';

// Mirrors the backend rules so most mistakes are caught before a request is sent.
const schema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ name, email, password }) => {
    setFormError('');
    try {
      await registerUser({ name, email, password });
      navigate('/', { replace: true });
    } catch (error) {
      if (!applyServerErrors(error, setError, ['name', 'email', 'password'])) setFormError(error.message);
    }
  };

  return (
    <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div><h2 className="auth-title">Create your account</h2><p className="muted">It takes less than a minute</p></div>
      <Alert>{formError}</Alert>
      <Field label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
      <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message}
        hint="8+ characters with upper and lower case letters and a number" {...register('password')} />
      <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <Button type="submit" loading={isSubmitting}>Create account</Button>
      <p className="muted center">Already registered? <Link to="/login">Log in</Link></p>
    </form>
  );
}
