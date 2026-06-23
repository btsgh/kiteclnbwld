'use client';

import { useState } from 'react';
import { bodyFont } from '@/app/fonts';

export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');

    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      const res = await fetch('/api/v1/kite-platform/contact-form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fd.get('email'),
          subject: fd.get('subject'),
          json_body: Object.fromEntries(fd),
        }),
      });

      if (res.ok) {
        setStatus('success');
        form.reset();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <label htmlFor="name" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Name</label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A]`}
        />
      </div>
      <div>
        <label htmlFor="email" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Email</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A]`}
        />
      </div>
      <div>
        <label htmlFor="subject" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Subject</label>
        <input
          type="text"
          id="subject"
          name="subject"
          required
          className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A]`}
        />
      </div>
      <div>
        <label htmlFor="message" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Message</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A] resize-none`}
        />
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className={`${bodyFont.className} rounded-full bg-[#1A1A1A] text-white px-8 py-4 uppercase tracking-wider text-sm hover:bg-[#1A1A1A]/90 transition-colors w-full mt-2 disabled:opacity-60`}
      >
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
      {status === 'success' && (
        <p className={`${bodyFont.className} text-sm text-green-600 mt-2 text-center`}>
          Message sent successfully!
        </p>
      )}
      {status === 'error' && (
        <p className={`${bodyFont.className} text-sm text-red-600 mt-2 text-center`}>
          There was an error sending your message. Please try again.
        </p>
      )}
    </form>
  );
}
