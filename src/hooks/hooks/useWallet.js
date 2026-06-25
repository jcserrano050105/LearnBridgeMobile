import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useWallet() {
  const { user } = useAuth();
  const [balance,      setBalance]      = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const fetchWallet = async () => {
    if (!user) return;
    const { data: tutor }  = await supabase.from('tutors').select('wallet_balance').eq('id', user.id).single();
    const { data: txns }   = await supabase.from('wallet_transactions').select('*').eq('tutor_id', user.id).order('created_at', { ascending: false });
    setBalance(tutor?.wallet_balance ?? 0);
    setTransactions(txns || []);
    setLoading(false);
  };

  useEffect(() => { fetchWallet(); }, [user]);

  const topUp = async (amount, method) => {
    const { error } = await supabase.from('wallet_transactions').insert({
      tutor_id: user.id, type: 'topup', amount, description: `Top-up via ${method}`,
    });
    if (error) throw error;
    await supabase.from('tutors').update({ wallet_balance: balance + amount }).eq('id', user.id);
    await fetchWallet();
  };

  return { balance, transactions, loading, topUp };
}
